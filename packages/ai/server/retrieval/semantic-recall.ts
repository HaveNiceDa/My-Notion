import { getOrCreateVectorStore } from "../vector-store-cache";
import { createRetrievalCandidate } from "./candidate";
import type { KnowledgeRetrievalOptions, RetrievalCandidate } from "./types";

const DEFAULT_SEMANTIC_MIN_SCORE = 0.6;

export async function semanticRecall(
  options: KnowledgeRetrievalOptions,
): Promise<RetrievalCandidate[]> {
  const vectorStore = await getOrCreateVectorStore(options.userId);
  const results = await vectorStore.similaritySearch(
    options.query,
    options.topK,
    options.minScore ?? DEFAULT_SEMANTIC_MIN_SCORE,
  );

  return results.map((result, index) =>
    createRetrievalCandidate(result, "semantic", index + 1),
  );
}
