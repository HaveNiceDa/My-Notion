import { getOrCreateVectorStore } from "../vector-store-cache";
import { createRetrievalCandidate } from "./candidate";
import type { KnowledgeRetrievalOptions, RetrievalCandidate } from "./types";

export async function metadataRecall(
  options: KnowledgeRetrievalOptions,
): Promise<RetrievalCandidate[]> {
  const vectorStore = await getOrCreateVectorStore(options.userId);
  const results = await vectorStore.metadataSearch(options.query, options.topK, {
    documentIds: options.filters?.documentIds,
    updatedAfter: options.filters?.updatedAfter,
  });

  return results.map((result, index) =>
    createRetrievalCandidate(result, "metadata", index + 1),
  );
}
