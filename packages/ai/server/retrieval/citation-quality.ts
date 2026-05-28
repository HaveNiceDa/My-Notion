import type {
  CitationQuality,
  CitationSourceScoreExplanation,
  RetrievalResultItem,
  RetrievalSource,
} from "./types";

export interface BuildCitationQualityOptions {
  items: RetrievalResultItem[];
  fusedCount: number;
  packedCount?: number;
  contextTokenBudget?: number;
  contextEstimatedTokens?: number;
  contextTruncated?: boolean;
}

// Citation Quality 为 Agent 和 UI 提供“这批引用是否足够可靠”的可解释信号。
export function buildCitationQuality(options: BuildCitationQualityOptions): CitationQuality {
  const totalItemCount = options.items.length;
  const citedItems = options.items.filter(hasCitation);
  const citationCoverage = totalItemCount === 0
    ? 0
    : Number((citedItems.length / totalItemCount).toFixed(4));
  const uniqueDocumentCount = new Set(citedItems.map((item) => item.documentId)).size;
  const sourceCoverage = buildSourceCoverage(options.items);
  const sourceScoreExplanations = options.items.map(buildItemQuality);
  const mergedItemCount = options.items.reduce((count, item) =>
    count + Math.max(getPackedItemCount(item) - 1, 0), 0);
  const needsMoreRetrieval = totalItemCount === 0 ||
    citationCoverage < 0.8 ||
    Boolean(options.contextTruncated);

  return {
    citationCoverage,
    citedItemCount: citedItems.length,
    totalItemCount,
    uniqueDocumentCount,
    sourceCoverage,
    sourceScoreExplanations,
    packing: {
      packedCount: options.packedCount,
      fusedCount: options.fusedCount,
      mergedItemCount,
      contextTokenBudget: options.contextTokenBudget,
      contextEstimatedTokens: options.contextEstimatedTokens,
      contextTruncated: options.contextTruncated,
      explanation: buildPackingExplanation({
        fusedCount: options.fusedCount,
        packedCount: options.packedCount ?? totalItemCount,
        mergedItemCount,
        contextTokenBudget: options.contextTokenBudget,
        contextEstimatedTokens: options.contextEstimatedTokens,
        contextTruncated: options.contextTruncated,
      }),
    },
    needsMoreRetrieval,
    explanation: buildOverallExplanation({
      totalItemCount,
      citationCoverage,
      uniqueDocumentCount,
      contextTruncated: options.contextTruncated,
      needsMoreRetrieval,
    }),
  };
}

function hasCitation(item: RetrievalResultItem): boolean {
  return Boolean(item.documentId && item.title && item.content.trim());
}

function buildSourceCoverage(
  items: RetrievalResultItem[],
): Partial<Record<RetrievalSource, number>> {
  const coverage: Partial<Record<RetrievalSource, number>> = {};
  const total = items.length;
  if (total === 0) return coverage;

  for (const source of ["semantic", "keyword", "metadata"] as const) {
    const count = items.filter((item) => item.sources.includes(source)).length;
    if (count > 0) {
      coverage[source] = Number((count / total).toFixed(4));
    }
  }

  return coverage;
}

function buildItemQuality(item: RetrievalResultItem): CitationQuality["sourceScoreExplanations"][number] {
  const packedItemCount = getPackedItemCount(item);
  const packedChunkIndexes = getPackedChunkIndexes(item);
  const sourceScores = buildSourceScoreExplanations(item);
  const truncated = Boolean(item.metadata.truncatedByTokenBudget);

  return {
    documentId: item.documentId,
    chunkId: item.chunkId,
    title: item.title,
    sources: item.sources,
    score: item.score,
    sourceScores,
    packedItemCount,
    packedChunkIndexes,
    truncated,
    explanation: buildItemExplanation(item, packedItemCount, truncated),
  };
}

function buildSourceScoreExplanations(item: RetrievalResultItem): CitationSourceScoreExplanation[] {
  const rawScores = item.metadata.sourceScores;
  const scores = rawScores && typeof rawScores === "object"
    ? rawScores as Partial<Record<RetrievalSource, number>>
    : {};

  return item.sources.map((source) => ({
    source,
    score: typeof scores[source] === "number" ? scores[source] : undefined,
    explanation: explainSourceScore(source, scores[source]),
  }));
}

function explainSourceScore(source: RetrievalSource, score: number | undefined): string {
  const scoreText = typeof score === "number" ? `score=${Number(score.toFixed(4))}` : "score unavailable";
  if (source === "semantic") {
    return `Semantic recall matched query meaning (${scoreText}).`;
  }
  if (source === "keyword") {
    return `Keyword recall matched exact terms or phrases (${scoreText}).`;
  }
  return `Metadata recall matched title, path, tags, recency, or structured filters (${scoreText}).`;
}

function buildItemExplanation(
  item: RetrievalResultItem,
  packedItemCount: number,
  truncated: boolean,
): string {
  const parts = [
    `Referenced "${item.title || item.documentId || item.chunkId}" from ${item.sources.join("+")} recall.`,
  ];
  if (packedItemCount > 1) {
    parts.push(`Merged ${packedItemCount} adjacent chunks from the same document.`);
  }
  if (truncated) {
    parts.push("Content was truncated to fit the context token budget.");
  }
  return parts.join(" ");
}

function buildPackingExplanation(options: {
  fusedCount: number;
  packedCount: number;
  mergedItemCount: number;
  contextTokenBudget?: number;
  contextEstimatedTokens?: number;
  contextTruncated?: boolean;
}): string {
  const parts = [
    `Packed ${options.fusedCount} fused chunks into ${options.packedCount} context items.`,
  ];
  if (options.mergedItemCount > 0) {
    parts.push(`Merged ${options.mergedItemCount} adjacent chunks.`);
  }
  if (typeof options.contextTokenBudget === "number") {
    parts.push(`Estimated ${options.contextEstimatedTokens ?? 0}/${options.contextTokenBudget} tokens used.`);
  }
  if (options.contextTruncated) {
    parts.push("Some context was truncated by the token budget.");
  }
  return parts.join(" ");
}

function buildOverallExplanation(options: {
  totalItemCount: number;
  citationCoverage: number;
  uniqueDocumentCount: number;
  contextTruncated?: boolean;
  needsMoreRetrieval: boolean;
}): string {
  if (options.totalItemCount === 0) {
    return "No retrievable citation was returned.";
  }

  const percent = Math.round(options.citationCoverage * 100);
  const parts = [
    `${percent}% of returned context items have document citations across ${options.uniqueDocumentCount} document(s).`,
  ];
  if (options.contextTruncated) {
    parts.push("Token budget truncation may reduce citation completeness.");
  }
  if (options.needsMoreRetrieval) {
    parts.push("Consider deeper retrieval if the answer requires stronger evidence.");
  }
  return parts.join(" ");
}

function getPackedItemCount(item: RetrievalResultItem): number {
  const value = item.metadata.packedItemCount;
  return typeof value === "number" && Number.isFinite(value) ? value : 1;
}

function getPackedChunkIndexes(item: RetrievalResultItem): number[] {
  const value = item.metadata.packedChunkIndexes;
  if (!Array.isArray(value)) {
    return item.chunkIndex === undefined ? [] : [item.chunkIndex];
  }
  return value.filter((index): index is number => typeof index === "number" && Number.isFinite(index));
}
