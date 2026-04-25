import { CustomEmbeddings } from "../embeddings";
import { QdrantVectorStoreWrapper } from "../rag";
import type { DocumentUpdateParams, DocumentDeleteParams } from "./types";

async function initVectorStore(
  userId: string,
): Promise<QdrantVectorStoreWrapper> {
  const vectorStore = new QdrantVectorStoreWrapper(
    userId,
    new CustomEmbeddings(),
  );
  await vectorStore.ensureCollectionExists();
  return vectorStore;
}

export async function updateDocument(params: DocumentUpdateParams): Promise<void> {
  const { userId, documentId, content, title } = params;
  const vectorStore = await initVectorStore(userId);
  await vectorStore.updateDocument(userId, documentId, content, title);
}

export async function deleteDocumentChunks(params: DocumentDeleteParams): Promise<void> {
  const { userId, documentId } = params;
  const vectorStore = await initVectorStore(userId);
  await vectorStore.deleteDocumentChunks(documentId);
}

export async function initKnowledgeBase(userId: string): Promise<void> {
  await initVectorStore(userId);
}
