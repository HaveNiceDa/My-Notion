export {
  createDocumentReadToolCall,
  executeDocumentRead,
  shouldReadCurrentDocument,
} from "./document-read";
export {
  createKnowledgeSearchToolCall,
  executeKnowledgeSearch,
  shouldUseKnowledgeSearch,
} from "./knowledge-search";
export type {
  CurrentDocumentContext,
  PendingToolCall,
  ToolExecutionResult,
} from "./types";
