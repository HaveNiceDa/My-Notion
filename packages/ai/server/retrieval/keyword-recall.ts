import { getOrCreateVectorStore } from "../vector-store-cache";
import { createRetrievalCandidate } from "./candidate";
import type { KnowledgeRetrievalOptions, RetrievalCandidate } from "./types";

export async function keywordRecall(
  options: KnowledgeRetrievalOptions,
): Promise<RetrievalCandidate[]> {
  const vectorStore = await getOrCreateVectorStore(options.userId);
  const results = await vectorStore.keywordSearch(options.query, options.topK, {
    documentIds: options.filters?.documentIds,
  });

  return results.map((result, index) =>
    createRetrievalCandidate(result, "keyword", index + 1),
  );
}
