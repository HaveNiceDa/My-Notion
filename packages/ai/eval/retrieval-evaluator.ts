import { buildCitationQuality } from "../server/retrieval/citation-quality";
import { packRetrievalContext } from "../server/retrieval/context-packing";
import { fuseCandidates } from "../server/retrieval/fusion";
import type {
  KnowledgeRetrievalResult,
  RetrievalCandidate,
  RetrievalSource,
} from "../server/retrieval";
import type { RetrievalEvalCase, RetrievalEvalDoc } from "./retrieval-eval-fixtures";

type ScoreKey = "semanticScore" | "keywordScore" | "metadataScore";

interface CaseMetric {
  id: string;
  passed: boolean;
  recallAtK: number;
  reciprocalRank: number;
  citationCoverage: number;
  truncation: boolean;
  needsMoreRetrieval: boolean;
  failures: string[];
  result: KnowledgeRetrievalResult;
}

export interface RetrievalEvalSummary {
  cases: number;
  passed: number;
  failed: number;
  recallAtK: number;
  mrr: number;
  citationCoverageAvg: number;
  truncationRate: number;
  needsMoreRetrievalRate: number;
  caseMetrics: CaseMetric[];
}

export function runRetrievalEval(cases: RetrievalEvalCase[]): RetrievalEvalSummary {
  const caseMetrics = cases.map((evalCase) => evaluateCase(evalCase));
  const casesCount = caseMetrics.length;

  return {
    cases: casesCount,
    passed: caseMetrics.filter((metric) => metric.passed).length,
    failed: caseMetrics.filter((metric) => !metric.passed).length,
    recallAtK: average(caseMetrics.map((metric) => metric.recallAtK)),
    mrr: average(caseMetrics.map((metric) => metric.reciprocalRank)),
    citationCoverageAvg: average(caseMetrics.map((metric) => metric.citationCoverage)),
    truncationRate: average(caseMetrics.map((metric) => metric.truncation ? 1 : 0)),
    needsMoreRetrievalRate: average(caseMetrics.map((metric) => metric.needsMoreRetrieval ? 1 : 0)),
    caseMetrics,
  };
}

export function evaluateCase(evalCase: RetrievalEvalCase): CaseMetric {
  const result = runSyntheticRetrieval(evalCase);
  const failures = assertCaseResult(result, evalCase);
  const expectedDocumentIds = new Set(evalCase.expected.documentIds);
  const firstExpectedRank = result.items.findIndex((item) => expectedDocumentIds.has(item.documentId));

  return {
    id: evalCase.id,
    passed: failures.length === 0,
    recallAtK: calculateRecallAtK(result, evalCase),
    reciprocalRank: firstExpectedRank === -1 ? 0 : 1 / (firstExpectedRank + 1),
    citationCoverage: result.metadata.citationQuality?.citationCoverage ?? 0,
    truncation: Boolean(result.metadata.contextTruncated),
    needsMoreRetrieval: Boolean(result.metadata.citationQuality?.needsMoreRetrieval),
    failures,
    result,
  };
}

// Synthetic eval 不访问真实向量库，只用固定分数模拟三路召回，便于 CI 和本地稳定复现。
export function runSyntheticRetrieval(evalCase: RetrievalEvalCase): KnowledgeRetrievalResult {
  const topK = Math.max(evalCase.topK, 1);
  const candidates = [
    ...createCandidates(evalCase.corpus, "semantic", "semanticScore", topK * 3),
    ...createCandidates(evalCase.corpus, "keyword", "keywordScore", topK * 3),
    ...createCandidates(evalCase.corpus, "metadata", "metadataScore", topK),
  ];
  const fused = fuseCandidates({ candidates, topK });
  const packed = packRetrievalContext({
    items: fused,
    tokenBudget: evalCase.contextTokenBudget,
  });
  const citationQuality = buildCitationQuality({
    items: packed.items,
    fusedCount: fused.length,
    ...packed.metadata,
  });

  return {
    query: evalCase.query,
    strategy: "balanced",
    items: packed.items,
    metadata: {
      semanticCount: candidates.filter((candidate) => candidate.source === "semantic").length,
      keywordCount: candidates.filter((candidate) => candidate.source === "keyword").length,
      metadataCount: candidates.filter((candidate) => candidate.source === "metadata").length,
      fusedCount: fused.length,
      ...packed.metadata,
      citationQuality,
    },
  };
}

export function formatRetrievalEvalSummary(summary: RetrievalEvalSummary): string {
  const lines = [
    "Retrieval Eval Summary",
    `cases: ${summary.cases}`,
    `pass: ${summary.passed}`,
    `fail: ${summary.failed}`,
    `recall@k: ${formatMetric(summary.recallAtK)}`,
    `mrr: ${formatMetric(summary.mrr)}`,
    `citationCoverageAvg: ${formatMetric(summary.citationCoverageAvg)}`,
    `truncationRate: ${formatMetric(summary.truncationRate)}`,
    `needsMoreRetrievalRate: ${formatMetric(summary.needsMoreRetrievalRate)}`,
    "",
    "Cases",
    ...summary.caseMetrics.map((metric) =>
      `${metric.passed ? "PASS" : "FAIL"} ${metric.id} recall@k=${formatMetric(metric.recallAtK)} mrr=${formatMetric(metric.reciprocalRank)} citation=${formatMetric(metric.citationCoverage)} truncated=${metric.truncation} needsMoreRetrieval=${metric.needsMoreRetrieval}`,
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

function assertCaseResult(result: KnowledgeRetrievalResult, evalCase: RetrievalEvalCase): string[] {
  const failures: string[] = [];
  const quality = result.metadata.citationQuality;

  for (const documentId of evalCase.expected.documentIds) {
    if (!result.items.some((item) => item.documentId === documentId)) {
      failures.push(`missing expected document ${documentId}`);
    }
  }

  if (!quality) {
    return [...failures, "missing citation quality"];
  }

  if (quality.citationCoverage < evalCase.expected.minCitationCoverage) {
    failures.push(`citation coverage ${quality.citationCoverage} < ${evalCase.expected.minCitationCoverage}`);
  }
  if (quality.uniqueDocumentCount < evalCase.expected.minUniqueDocuments) {
    failures.push(`unique documents ${quality.uniqueDocumentCount} < ${evalCase.expected.minUniqueDocuments}`);
  }
  if (quality.needsMoreRetrieval !== evalCase.expected.needsMoreRetrieval) {
    failures.push(`needsMoreRetrieval ${quality.needsMoreRetrieval} != ${evalCase.expected.needsMoreRetrieval}`);
  }
  if (
    evalCase.expected.maxPackedCount !== undefined &&
    (result.metadata.packedCount ?? result.items.length) > evalCase.expected.maxPackedCount
  ) {
    failures.push(`packed count ${result.metadata.packedCount ?? result.items.length} > ${evalCase.expected.maxPackedCount}`);
  }
  if (
    evalCase.expected.contextTruncated !== undefined &&
    result.metadata.contextTruncated !== evalCase.expected.contextTruncated
  ) {
    failures.push(`contextTruncated ${result.metadata.contextTruncated} != ${evalCase.expected.contextTruncated}`);
  }
  if (
    evalCase.expected.mergedItemCountAtLeast !== undefined &&
    quality.packing.mergedItemCount < evalCase.expected.mergedItemCountAtLeast
  ) {
    failures.push(`merged item count ${quality.packing.mergedItemCount} < ${evalCase.expected.mergedItemCountAtLeast}`);
  }
  for (const source of evalCase.expected.requiredSources ?? []) {
    if ((quality.sourceCoverage[source] ?? 0) <= 0) {
      failures.push(`missing required source ${source}`);
    }
  }

  return failures;
}

function calculateRecallAtK(result: KnowledgeRetrievalResult, evalCase: RetrievalEvalCase): number {
  const retrieved = new Set(result.items.map((item) => item.documentId));
  const expected = evalCase.expected.documentIds;
  const hitCount = expected.filter((documentId) => retrieved.has(documentId)).length;
  return expected.length === 0 ? 1 : hitCount / expected.length;
}

function createCandidates(
  corpus: RetrievalEvalDoc[],
  source: RetrievalSource,
  scoreKey: ScoreKey,
  topK: number,
): RetrievalCandidate[] {
  return corpus
    .filter((item) => typeof item[scoreKey] === "number")
    .sort((a, b) => (b[scoreKey] ?? 0) - (a[scoreKey] ?? 0))
    .slice(0, topK)
    .map((item, index) => ({
      documentId: item.documentId,
      chunkId: `${item.documentId}:${item.chunkIndex}`,
      chunkIndex: item.chunkIndex,
      title: item.title,
      content: item.content,
      score: item[scoreKey] ?? 0,
      source,
      rank: index + 1,
      metadata: {
        documentId: item.documentId,
        title: item.title,
        chunkIndex: item.chunkIndex,
      },
    }));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: number): string {
  return value.toFixed(2);
}
