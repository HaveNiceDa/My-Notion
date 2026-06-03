import { fallbackRankMemories } from "../server/memory";
import type { AgentMemoryRecord } from "../server/memory";
import type { MemoryRetrievalEvalCase } from "./memory-retrieval-eval-fixtures";

export interface MemoryRetrievalCaseMetric {
  id: string;
  passed: boolean;
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
  wrongScopeHitRate: number;
  staleHitRate: number;
  sensitiveLeakageRate: number;
  failures: string[];
  retrievedIds: string[];
}

export interface MemoryRetrievalEvalSummary {
  cases: number;
  passed: number;
  failed: number;
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  wrongScopeHitRate: number;
  staleHitRate: number;
  sensitiveLeakageRate: number;
  caseMetrics: MemoryRetrievalCaseMetric[];
}

export function runMemoryRetrievalEval(cases: MemoryRetrievalEvalCase[]): MemoryRetrievalEvalSummary {
  const caseMetrics = cases.map((evalCase) => evaluateMemoryRetrievalCase(evalCase));
  return {
    cases: caseMetrics.length,
    passed: caseMetrics.filter((metric) => metric.passed).length,
    failed: caseMetrics.filter((metric) => !metric.passed).length,
    recallAtK: average(caseMetrics.map((metric) => metric.recallAtK)),
    precisionAtK: average(caseMetrics.map((metric) => metric.precisionAtK)),
    mrr: average(caseMetrics.map((metric) => metric.reciprocalRank)),
    wrongScopeHitRate: average(caseMetrics.map((metric) => metric.wrongScopeHitRate)),
    staleHitRate: average(caseMetrics.map((metric) => metric.staleHitRate)),
    sensitiveLeakageRate: average(caseMetrics.map((metric) => metric.sensitiveLeakageRate)),
    caseMetrics,
  };
}

export function evaluateMemoryRetrievalCase(evalCase: MemoryRetrievalEvalCase): MemoryRetrievalCaseMetric {
  const safeMemories = evalCase.memories.filter((memory) =>
    memory.status !== "deleted"
    && memory.status !== "rejected"
    && memory.privacy !== "sensitive"
    && !isStale(memory)
    && matchesAnyScope(memory, evalCase.scopes),
  );
  const retrieved = fallbackRankMemories(evalCase.query, safeMemories, evalCase.topK, evalCase.scopes);
  const retrievedIds = retrieved.map((memory) => memory.id);
  const expectedIds = new Set(evalCase.expectedMemoryIds);
  const forbiddenIds = new Set(evalCase.forbiddenMemoryIds ?? []);
  const hitCount = retrievedIds.filter((id) => expectedIds.has(id)).length;
  const firstExpectedRank = retrievedIds.findIndex((id) => expectedIds.has(id));
  const wrongScopeHits = retrieved.filter((memory) => !matchesAnyScope(memory, evalCase.scopes));
  const staleHits = retrieved.filter(isStale);
  const sensitiveHits = retrieved.filter((memory) => memory.privacy === "sensitive");
  const failures: string[] = [];

  for (const expectedId of expectedIds) {
    if (!retrievedIds.includes(expectedId)) {
      failures.push(`missing expected memory ${expectedId}`);
    }
  }
  for (const forbiddenId of forbiddenIds) {
    if (retrievedIds.includes(forbiddenId)) {
      failures.push(`retrieved forbidden memory ${forbiddenId}`);
    }
  }
  if (sensitiveHits.length > 0) {
    failures.push(`sensitive leakage ${sensitiveHits.map((memory) => memory.id).join(",")}`);
  }
  if (staleHits.length > 0) {
    failures.push(`stale hit ${staleHits.map((memory) => memory.id).join(",")}`);
  }

  return {
    id: evalCase.id,
    passed: failures.length === 0,
    recallAtK: expectedIds.size === 0 ? 1 : hitCount / expectedIds.size,
    precisionAtK: retrieved.length === 0 ? 0 : hitCount / retrieved.length,
    reciprocalRank: firstExpectedRank === -1 ? 0 : 1 / (firstExpectedRank + 1),
    wrongScopeHitRate: retrieved.length === 0 ? 0 : wrongScopeHits.length / retrieved.length,
    staleHitRate: retrieved.length === 0 ? 0 : staleHits.length / retrieved.length,
    sensitiveLeakageRate: retrieved.length === 0 ? 0 : sensitiveHits.length / retrieved.length,
    failures,
    retrievedIds,
  };
}

export function formatMemoryRetrievalEvalSummary(summary: MemoryRetrievalEvalSummary): string {
  const lines = [
    "Memory Retrieval Eval Summary",
    `cases: ${summary.cases}`,
    `pass: ${summary.passed}`,
    `fail: ${summary.failed}`,
    `recall@k: ${formatMetric(summary.recallAtK)}`,
    `precision@k: ${formatMetric(summary.precisionAtK)}`,
    `mrr: ${formatMetric(summary.mrr)}`,
    `wrongScopeHitRate: ${formatMetric(summary.wrongScopeHitRate)}`,
    `staleHitRate: ${formatMetric(summary.staleHitRate)}`,
    `sensitiveLeakageRate: ${formatMetric(summary.sensitiveLeakageRate)}`,
    "",
    "Cases",
    ...summary.caseMetrics.map((metric) =>
      `${metric.passed ? "PASS" : "FAIL"} ${metric.id} recall@k=${formatMetric(metric.recallAtK)} precision@k=${formatMetric(metric.precisionAtK)} mrr=${formatMetric(metric.reciprocalRank)} retrieved=[${metric.retrievedIds.join(",")}]`,
    ),
  ];
  const failures = summary.caseMetrics.flatMap((metric) =>
    metric.failures.map((failure) => `${metric.id}: ${failure}`),
  );
  if (failures.length > 0) {
    lines.push("", "Failures", ...failures);
  }
  return lines.join("\n");
}

function matchesAnyScope(memory: AgentMemoryRecord, scopes: MemoryRetrievalEvalCase["scopes"]): boolean {
  if (!scopes?.length) return true;
  if (memory.scopeLevel === "user") return true;
  return scopes.some((scope) => scope.level === memory.scopeLevel && scope.key === memory.scopeKey);
}

function isStale(memory: AgentMemoryRecord): boolean {
  const now = Date.now();
  return Boolean(
    (memory.expiresAt && memory.expiresAt <= now)
    || (memory.reviewDueAt && memory.reviewDueAt <= now),
  );
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: number): string {
  return value.toFixed(2);
}
