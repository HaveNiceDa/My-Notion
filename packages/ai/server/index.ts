export { streamChat } from "./chat";
export { streamRAG } from "./rag";
export { retrieveKnowledge } from "./retrieval";
export { updateDocument, deleteDocumentChunks, initKnowledgeBase } from "./documents";
export { ConvexDataSource } from "./data-source";
export {
  getOrCreateVectorStore,
  computeContentHash,
  getCachedDocumentHash,
  setCachedDocumentHash,
  invalidateDocumentHash,
  clearVectorStoreCache,
} from "./vector-store-cache";
export type { DataSource } from "./data-source";
export type {
  AIStreamEvent,
  AIStreamCallback,
  ChatMessage,
  ChatOptions,
  RAGOptions,
  ToolCallDelta,
  ToolCallResult,
  DocumentUpdateParams,
  DocumentDeleteParams,
  KnowledgeBaseDocument,
} from "./types";
export type {
  KnowledgeRetrievalFilters,
  KnowledgeRetrievalOptions,
  KnowledgeRetrievalResult,
  RetrievalCandidate,
  RetrievalResultItem,
  RetrievalSource,
  RetrievalStrategy,
} from "./retrieval";
