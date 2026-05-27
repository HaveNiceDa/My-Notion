import { fuseCandidates } from "./fusion";
import { keywordRecall } from "./keyword-recall";
import { metadataRecall } from "./metadata-recall";
import { semanticRecall } from "./semantic-recall";
import type {
  KnowledgeRetrievalOptions,
  KnowledgeRetrievalResult,
  RetrievalCandidate,
  RetrievalStrategy,
} from "./types";

const DEFAULT_TOP_K = 3;
const MAX_TOP_K = 8;
const DEFAULT_MIN_SCORE = 0.6;

export async function retrieveKnowledge(
  options: KnowledgeRetrievalOptions,
): Promise<KnowledgeRetrievalResult> {
  const query = options.query.trim();
  const strategy = options.strategy ?? "balanced";
  const topK = clampTopK(options.topK);
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  if (!query) {
    return emptyResult(query, strategy);
  }

  if (strategy === "fast") {
    // fast 保持旧行为：只走语义向量召回，适合实时聊天里的低延迟路径。
    const semantic = await semanticRecall({ ...options, query, topK, minScore });
    return buildResult(query, strategy, semantic, [], [], semantic.map(toSingleSourceItem));
  }

  if (strategy === "deep") {
    // deep 后续会接 query rewrite / multi-query / rerank；当前先复用 balanced 流程并保留策略标识。
    return retrieveBalanced({ ...options, query, topK, minScore }, "deep");
  }

  return retrieveBalanced({ ...options, query, topK, minScore }, "balanced");
}

async function retrieveBalanced(
  options: KnowledgeRetrievalOptions,
  strategy: RetrievalStrategy,
): Promise<KnowledgeRetrievalResult> {
  const topK = clampTopK(options.topK);
  // balanced 是默认混合检索：三路召回并发执行，减少单一路径漏召。
  const [semantic, keyword, metadata] = await Promise.all([
    semanticRecall({ ...options, topK: topK * 3 }),
    keywordRecall({ ...options, topK: topK * 3 }),
    metadataRecall({ ...options, topK }),
  ]);

  // 不同召回通道的分数分布不同，先用 RRF 做排名融合，避免直接相加导致分数不可比。
  const fused = fuseCandidates({
    candidates: [...semantic, ...keyword, ...metadata],
    topK,
  });

  return buildResult(options.query, strategy, semantic, keyword, metadata, fused);
}

export type {
  KnowledgeRetrievalFilters,
  KnowledgeRetrievalOptions,
  KnowledgeRetrievalResult,
  RetrievalCandidate,
  RetrievalResultItem,
  RetrievalSource,
  RetrievalStrategy,
} from "./types";

function clampTopK(topK: number | undefined): number {
  if (typeof topK !== "number" || !Number.isFinite(topK)) {
    return DEFAULT_TOP_K;
  }

  return Math.min(Math.max(Math.floor(topK), 1), MAX_TOP_K);
}

function emptyResult(
  query: string,
  strategy: RetrievalStrategy,
): KnowledgeRetrievalResult {
  return {
    query,
    strategy,
    items: [],
    metadata: {
      semanticCount: 0,
      keywordCount: 0,
      metadataCount: 0,
      fusedCount: 0,
    },
  };
}

function buildResult(
  query: string,
  strategy: RetrievalStrategy,
  semantic: RetrievalCandidate[],
  keyword: RetrievalCandidate[],
  metadata: RetrievalCandidate[],
  items: KnowledgeRetrievalResult["items"],
): KnowledgeRetrievalResult {
  return {
    query,
    strategy,
    items,
    metadata: {
      semanticCount: semantic.length,
      keywordCount: keyword.length,
      metadataCount: metadata.length,
      fusedCount: items.length,
    },
  };
}

function toSingleSourceItem(candidate: RetrievalCandidate): KnowledgeRetrievalResult["items"][number] {
  return {
    documentId: candidate.documentId,
    chunkId: candidate.chunkId,
    chunkIndex: candidate.chunkIndex,
    title: candidate.title,
    content: candidate.content,
    score: Number(candidate.score.toFixed(4)),
    sources: [candidate.source],
    metadata: candidate.metadata,
  };
}
