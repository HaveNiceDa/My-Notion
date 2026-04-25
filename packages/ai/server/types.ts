import type { DataSource } from "./data-source";

export type AIStreamEvent =
  | { type: "content"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool_call_start"; tool_calls: ToolCallDelta[] }
  | { type: "tool_executing"; tool_name: string; tool_args: any }
  | { type: "tool_result"; tool_name: string; result: string }
  | { type: "thinking_step"; step_type: string; content: string; details?: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ToolCallDelta {
  index?: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: ToolCallResult[];
}

export interface ToolCallResult {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatOptions {
  model: string;
  enableThinking?: boolean;
  thinkingBudget?: number;
}

export interface RAGOptions {
  userId: string;
  model: string;
  conversationHistory: ChatMessage[];
  dataSource?: DataSource;
  minScore?: number;
  knowledgeBaseEnabled?: boolean;
  conversationId?: string;
  enableThinking?: boolean;
  thinkingBudget?: number;
}

export interface DocumentUpdateParams {
  userId: string;
  documentId: string;
  content: string;
  title: string;
}

export interface DocumentDeleteParams {
  userId: string;
  documentId: string;
}

export interface KnowledgeBaseDocument {
  _id: string;
  title: string;
  content?: string;
}

export type AIStreamCallback = (event: AIStreamEvent) => void;
