import type {
  RetrievalResultItem,
  RetrievalSource,
} from "./types";

const DEFAULT_CONTEXT_TOKEN_BUDGET = 2400;
const MIN_TRUNCATED_TOKENS = 24;

export interface ContextPackingOptions {
  items: RetrievalResultItem[];
  tokenBudget?: number;
}

export interface ContextPackingResult {
  items: RetrievalResultItem[];
  metadata: {
    packedCount: number;
    contextTokenBudget: number;
    contextEstimatedTokens: number;
    contextTruncated: boolean;
  };
}

interface PackingGroup {
  documentId: string;
  title: string;
  items: Array<RetrievalResultItem & { originalIndex: number }>;
}

// Context Packing 将同一文档的相邻 chunk 合并，再按 token budget 裁剪，减少碎片化上下文。
export function packRetrievalContext(options: ContextPackingOptions): ContextPackingResult {
  const tokenBudget = normalizeTokenBudget(options.tokenBudget);
  const packed = buildPackedItems(options.items);
  const budgeted = applyTokenBudget(packed, tokenBudget);

  return {
    items: budgeted.items,
    metadata: {
      packedCount: budgeted.items.length,
      contextTokenBudget: tokenBudget,
      contextEstimatedTokens: budgeted.estimatedTokens,
      contextTruncated: budgeted.truncated,
    },
  };
}

function buildPackedItems(items: RetrievalResultItem[]): RetrievalResultItem[] {
  const groups = groupByDocument(items);
  const packed: Array<RetrievalResultItem & { originalIndex: number }> = [];

  for (const group of groups) {
    const sorted = [...group.items].sort(compareByChunkIndex);
    let currentRun: Array<RetrievalResultItem & { originalIndex: number }> = [];

    for (const item of sorted) {
      if (currentRun.length === 0 || isAdjacent(currentRun[currentRun.length - 1], item)) {
        currentRun.push(item);
        continue;
      }

      packed.push(packRun(group, currentRun));
      currentRun = [item];
    }

    if (currentRun.length > 0) {
      packed.push(packRun(group, currentRun));
    }
  }

  return packed
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ originalIndex: _originalIndex, ...item }) => item);
}

function groupByDocument(items: RetrievalResultItem[]): PackingGroup[] {
  const groups = new Map<string, PackingGroup>();

  items.forEach((item, originalIndex) => {
    const key = item.documentId || `unknown:${originalIndex}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push({ ...item, originalIndex });
      return;
    }

    groups.set(key, {
      documentId: item.documentId,
      title: item.title,
      items: [{ ...item, originalIndex }],
    });
  });

  return Array.from(groups.values());
}

function compareByChunkIndex(
  a: RetrievalResultItem & { originalIndex: number },
  b: RetrievalResultItem & { originalIndex: number },
): number {
  if (a.chunkIndex !== undefined && b.chunkIndex !== undefined) {
    if (a.chunkIndex !== b.chunkIndex) return a.chunkIndex - b.chunkIndex;
  }
  return a.originalIndex - b.originalIndex;
}

function isAdjacent(
  previous: RetrievalResultItem,
  next: RetrievalResultItem,
): boolean {
  if (previous.documentId !== next.documentId) return false;
  if (previous.chunkIndex === undefined || next.chunkIndex === undefined) return false;
  return next.chunkIndex - previous.chunkIndex === 1;
}

function packRun(
  group: PackingGroup,
  run: Array<RetrievalResultItem & { originalIndex: number }>,
): RetrievalResultItem & { originalIndex: number } {
  if (run.length === 1) {
    const [item] = run;
    return {
      ...item,
      metadata: {
        ...item.metadata,
        packedItemCount: 1,
        estimatedTokens: estimateTokens(item.content),
      },
    };
  }

  const primary = [...run].sort((a, b) => b.score - a.score)[0];
  const chunkIndexes = run
    .map((item) => item.chunkIndex)
    .filter((value): value is number => value !== undefined);
  const startIndex = chunkIndexes.length > 0 ? Math.min(...chunkIndexes) : undefined;
  const endIndex = chunkIndexes.length > 0 ? Math.max(...chunkIndexes) : undefined;
  const content = joinChunkContents(run.map((item) => item.content));
  const sources = mergeSources(run);
  const sourceScores = mergeSourceScores(run);

  return {
    documentId: group.documentId,
    chunkId: startIndex !== undefined && endIndex !== undefined
      ? `${group.documentId}:${startIndex}-${endIndex}`
      : primary.chunkId,
    chunkIndex: startIndex,
    title: primary.title || group.title,
    content,
    score: Number(Math.max(...run.map((item) => item.score)).toFixed(4)),
    sources,
    metadata: {
      ...primary.metadata,
      sourceScores,
      packed: true,
      packedChunkIds: run.map((item) => item.chunkId),
      packedChunkIndexes: chunkIndexes,
      packedItemCount: run.length,
      estimatedTokens: estimateTokens(content),
    },
    originalIndex: Math.min(...run.map((item) => item.originalIndex)),
  };
}

function joinChunkContents(contents: string[]): string {
  const deduped: string[] = [];
  for (const content of contents) {
    if (!content.trim()) continue;
    if (deduped[deduped.length - 1] === content) continue;
    deduped.push(content);
  }
  return deduped.join("\n\n");
}

function mergeSources(items: RetrievalResultItem[]): RetrievalSource[] {
  return Array.from(new Set(items.flatMap((item) => item.sources)));
}

function mergeSourceScores(
  items: RetrievalResultItem[],
): Partial<Record<RetrievalSource, number>> | undefined {
  const merged: Partial<Record<RetrievalSource, number>> = {};

  for (const item of items) {
    const scores = item.metadata.sourceScores;
    if (!scores || typeof scores !== "object") continue;

    for (const [source, score] of Object.entries(scores as Record<string, unknown>)) {
      if (!isRetrievalSource(source) || typeof score !== "number") continue;
      merged[source] = Math.max(merged[source] ?? Number.NEGATIVE_INFINITY, score);
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function applyTokenBudget(
  items: RetrievalResultItem[],
  tokenBudget: number,
): { items: RetrievalResultItem[]; estimatedTokens: number; truncated: boolean } {
  const budgeted: RetrievalResultItem[] = [];
  let remainingTokens = tokenBudget;
  let estimatedTokens = 0;
  let truncated = false;

  for (const item of items) {
    if (remainingTokens <= 0) {
      truncated = true;
      break;
    }

    const itemTokens = estimateTokens(item.content);
    if (itemTokens <= remainingTokens) {
      budgeted.push(withEstimatedTokens(item, itemTokens));
      remainingTokens -= itemTokens;
      estimatedTokens += itemTokens;
      continue;
    }

    if (remainingTokens >= MIN_TRUNCATED_TOKENS) {
      const truncatedContent = truncateToTokenBudget(item.content, remainingTokens);
      const truncatedTokens = estimateTokens(truncatedContent);
      budgeted.push({
        ...item,
        content: truncatedContent,
        metadata: {
          ...item.metadata,
          estimatedTokens: truncatedTokens,
          originalEstimatedTokens: itemTokens,
          truncatedByTokenBudget: true,
        },
      });
      estimatedTokens += truncatedTokens;
    }

    truncated = true;
    break;
  }

  return { items: budgeted, estimatedTokens, truncated };
}

function withEstimatedTokens(item: RetrievalResultItem, estimatedTokens: number): RetrievalResultItem {
  return {
    ...item,
    metadata: {
      ...item.metadata,
      estimatedTokens,
    },
  };
}

function truncateToTokenBudget(content: string, tokenBudget: number): string {
  const targetChars = Math.max(tokenBudget * 3, 1);
  if (content.length <= targetChars) return content;
  return `${content.slice(0, targetChars).trimEnd()}\n...[truncated]`;
}

function estimateTokens(content: string): number {
  const cjkChars = content.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const nonCjkChars = Math.max(content.length - cjkChars, 0);
  return Math.max(1, Math.ceil(cjkChars + nonCjkChars / 4));
}

function normalizeTokenBudget(tokenBudget: number | undefined): number {
  if (typeof tokenBudget !== "number" || !Number.isFinite(tokenBudget)) {
    return DEFAULT_CONTEXT_TOKEN_BUDGET;
  }
  return Math.max(Math.floor(tokenBudget), MIN_TRUNCATED_TOKENS);
}

function isRetrievalSource(value: string): value is RetrievalSource {
  return value === "semantic" || value === "keyword" || value === "metadata";
}
