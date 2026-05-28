import { fuseCandidates } from "./fusion";
import { keywordRecall } from "./keyword-recall";
import { metadataRecall } from "./metadata-recall";
import { packRetrievalContext } from "./context-packing";
import { buildCitationQuality } from "./citation-quality";
import { rewriteQueryForDeepRetrieval } from "./query-rewrite";
import { semanticRecall } from "./semantic-recall";
import type {
  KnowledgeRetrievalOptions,
  KnowledgeRetrievalResult,
  QueryRewriteVariant,
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
    const items = semantic.map(toSingleSourceItem);
    return buildResult(query, strategy, semantic, [], [], items, items, {
      citationQuality: buildCitationQuality({
        items,
        fusedCount: items.length,
      }),
    });
  }

  if (strategy === "deep") {
    return retrieveDeep({ ...options, query, topK, minScore });
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

  const packed = packRetrievalContext({
    items: fused,
    tokenBudget: options.contextTokenBudget,
  });

  return buildResult(options.query, strategy, semantic, keyword, metadata, fused, packed.items, {
    ...packed.metadata,
    citationQuality: buildCitationQuality({
      items: packed.items,
      fusedCount: fused.length,
      ...packed.metadata,
    }),
  });
}

async function retrieveDeep(
  options: KnowledgeRetrievalOptions,
): Promise<KnowledgeRetrievalResult> {
  const topK = clampTopK(options.topK);
  const queryVariants = await rewriteQueryForDeepRetrieval(options.query);

  // deep 会对原问题、关键词版、语义扩展版分别召回，再统一融合，降低单个 query 表达不准的漏召风险。
  const recallGroups = await Promise.all(
    queryVariants.map((variant) => retrieveVariantCandidates(options, variant, topK)),
  );

  const semantic = recallGroups.flatMap((group) => group.semantic);
  const keyword = recallGroups.flatMap((group) => group.keyword);
  const metadata = recallGroups.flatMap((group) => group.metadata);
  const fused = fuseCandidates({
    candidates: [...semantic, ...keyword, ...metadata],
    topK,
  });

  const packed = packRetrievalContext({
    items: fused,
    tokenBudget: options.contextTokenBudget,
  });

  return buildResult(options.query, "deep", semantic, keyword, metadata, fused, packed.items, {
    ...packed.metadata,
    citationQuality: buildCitationQuality({
      items: packed.items,
      fusedCount: fused.length,
      ...packed.metadata,
    }),
    queryVariants,
  });
}

async function retrieveVariantCandidates(
  options: KnowledgeRetrievalOptions,
  variant: QueryRewriteVariant,
  topK: number,
): Promise<{
  semantic: RetrievalCandidate[];
  keyword: RetrievalCandidate[];
  metadata: RetrievalCandidate[];
}> {
  const variantOptions = { ...options, query: variant.query };
  const [semantic, keyword, metadata] = await Promise.all([
    semanticRecall({ ...variantOptions, topK: topK * 3 }),
    keywordRecall({ ...variantOptions, topK: topK * 3 }),
    metadataRecall({ ...variantOptions, topK }),
  ]);

  return {
    semantic: tagQueryVariant(semantic, variant),
    keyword: tagQueryVariant(keyword, variant),
    metadata: tagQueryVariant(metadata, variant),
  };
}

export type {
  CitationItemQuality,
  CitationQuality,
  CitationSourceScoreExplanation,
  KnowledgeRetrievalFilters,
  KnowledgeRetrievalOptions,
  KnowledgeRetrievalResult,
  QueryRewriteVariant,
  QueryRewriteVariantKind,
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
  fusedItems: KnowledgeRetrievalResult["items"],
  items: KnowledgeRetrievalResult["items"] = fusedItems,
  extraMetadata?: Partial<KnowledgeRetrievalResult["metadata"]>,
): KnowledgeRetrievalResult {
  return {
    query,
    strategy,
    items,
    metadata: {
      semanticCount: semantic.length,
      keywordCount: keyword.length,
      metadataCount: metadata.length,
      fusedCount: fusedItems.length,
      ...extraMetadata,
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

function tagQueryVariant(
  candidates: RetrievalCandidate[],
  variant: QueryRewriteVariant,
): RetrievalCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    metadata: {
      ...candidate.metadata,
      queryVariant: variant,
    },
  }));
}
