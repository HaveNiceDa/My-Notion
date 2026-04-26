import { createHash } from "crypto";
import { CustomEmbeddings } from "../embeddings";
import { QdrantVectorStoreWrapper } from "../rag";

const vectorStoreCache = new Map<string, QdrantVectorStoreWrapper>();

const documentSyncCache = new Map<string, string>();

export function computeContentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

export function getCachedDocumentHash(
  userId: string,
  documentId: string,
): string | undefined {
  return documentSyncCache.get(`${userId}:${documentId}`);
}

export function setCachedDocumentHash(
  userId: string,
  documentId: string,
  hash: string,
): void {
  documentSyncCache.set(`${userId}:${documentId}`, hash);
}

export function invalidateDocumentHash(
  userId: string,
  documentId: string,
): void {
  documentSyncCache.delete(`${userId}:${documentId}`);
}

export async function getOrCreateVectorStore(
  userId: string,
): Promise<QdrantVectorStoreWrapper> {
  const cached = vectorStoreCache.get(userId);
  if (cached) return cached;

  const vectorStore = new QdrantVectorStoreWrapper(
    userId,
    new CustomEmbeddings(),
  );
  await vectorStore.ensureCollectionExists();
  vectorStoreCache.set(userId, vectorStore);
  return vectorStore;
}

export function clearVectorStoreCache(userId?: string): void {
  if (userId) {
    vectorStoreCache.delete(userId);
  } else {
    vectorStoreCache.clear();
  }
}
