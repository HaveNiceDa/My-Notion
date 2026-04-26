import { computeContentHash, getOrCreateVectorStore, invalidateDocumentHash, setCachedDocumentHash } from "./vector-store-cache";
import type { DocumentUpdateParams, DocumentDeleteParams } from "./types";

export async function updateDocument(params: DocumentUpdateParams): Promise<void> {
  const { userId, documentId, content, title } = params;
  const vectorStore = await getOrCreateVectorStore(userId);
  const contentHash = computeContentHash(content);
  await vectorStore.updateDocument(userId, documentId, content, title, contentHash);
  setCachedDocumentHash(userId, documentId, contentHash);
}

export async function deleteDocumentChunks(params: DocumentDeleteParams): Promise<void> {
  const { userId, documentId } = params;
  const vectorStore = await getOrCreateVectorStore(userId);
  await vectorStore.deleteDocumentChunks(documentId);
  invalidateDocumentHash(userId, documentId);
}

export async function initKnowledgeBase(userId: string): Promise<void> {
  await getOrCreateVectorStore(userId);
}
