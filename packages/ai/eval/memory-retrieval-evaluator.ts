import { fallbackRankMemories } from "../server/memory";
import type { MemoryRetrievalEvalCase } from "./memory-retrieval-eval-fixtures";

export interface MemoryRetrievalCaseMetric {
  id: string;
  passed: boolean;
  recallAtK: number;
  precisionAtK: number;
  reciprocalRank: number;
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
    caseMetrics,
  };
}

export function evaluateMemoryRetrievalCase(evalCase: MemoryRetrievalEvalCase): MemoryRetrievalCaseMetric {
  const retrieved = fallbackRankMemories(evalCase.query, evalCase.memories, evalCase.topK);
  const retrievedIds = retrieved.map((memory) => memory.id);
  const expectedIds = new Set(evalCase.expectedMemoryIds);
  const forbiddenIds = new Set(evalCase.forbiddenMemoryIds ?? []);
  const hitCount = retrievedIds.filter((id) => expectedIds.has(id)).length;
  const firstExpectedRank = retrievedIds.findIndex((id) => expectedIds.has(id));
  const failures: string[] = [];

  for (const expectedId of expectedIds) {
    if (!retrievedIds.includes(expectedId)) failures.push(`missing expected memory ${expectedId}`);
  }
  for (const forbiddenId of forbiddenIds) {
    if (retrievedIds.includes(forbiddenId)) failures.push(`retrieved forbidden memory ${forbiddenId}`);
  }

  return {
    id: evalCase.id,
    passed: failures.length === 0,
    recallAtK: expectedIds.size === 0 ? 1 : hitCount / expectedIds.size,
    precisionAtK: retrieved.length === 0 ? 0 : hitCount / retrieved.length,
    reciprocalRank: firstExpectedRank === -1 ? 0 : 1 / (firstExpectedRank + 1),
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
    "",
    "Cases",
    ...summary.caseMetrics.map((metric) =>
      `${metric.passed ? "PASS" : "FAIL"} ${metric.id} recall@k=${formatMetric(metric.recallAtK)} precision@k=${formatMetric(metric.precisionAtK)} mrr=${formatMetric(metric.reciprocalRank)} retrieved=[${metric.retrievedIds.join(",")}]`,
    ),
  ];
  const failures = summary.caseMetrics.flatMap((metric) =>
    metric.failures.map((failure) => `${metric.id}: ${failure}`),
  );
  if (failures.length > 0) lines.push("", "Failures", ...failures);
  return lines.join("\n");
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: number): string {
  return value.toFixed(2);
}
