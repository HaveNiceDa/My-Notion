import { getOrCreateVectorStore } from "../vector-store-cache";
import { createRetrievalCandidate } from "./candidate";
import type { KnowledgeRetrievalOptions, RetrievalCandidate } from "./types";

const DEFAULT_SEMANTIC_MIN_SCORE = 0.6;

export async function semanticRecall(
  options: KnowledgeRetrievalOptions,
): Promise<RetrievalCandidate[]> {
  const vectorStore = await getOrCreateVectorStore(options.userId);
  // 语义召回负责“换一种说法也能搜到”，过滤条件只做召回范围控制，不做关键词打分。
  const results = await vectorStore.semanticSearch(
    options.query,
    options.topK,
    options.minScore ?? DEFAULT_SEMANTIC_MIN_SCORE,
    {
      includeDocumentIds: options.filters?.documentIds,
    },
  );

  return results.map((result, index) =>
    createRetrievalCandidate(result, "semantic", index + 1),
  );
}
