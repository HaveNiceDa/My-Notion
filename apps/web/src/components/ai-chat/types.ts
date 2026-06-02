import type { Id } from "@/convex/_generated/dataModel";

export interface KnowledgeSearchDoc {
  documentId: string;
  title: string;
  score: number;
  content: string;
  sources?: Array<"semantic" | "keyword" | "metadata">;
  metadata?: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  name: string;
  status: "calling" | "executing" | "completed" | "error";
  parameters?: Record<string, unknown>;
  result?: unknown;
  duplicateCount?: number;
}

export type AgentRunMode = "chat" | "plan";

export interface TaskPlanStep {
  id?: string;
  title?: string;
  description?: string;
  status?: "pending" | "in_progress" | "completed" | "blocked";
}

export interface TaskPlanToolResult {
  objective?: string;
  steps?: TaskPlanStep[];
  summary?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  reasoningContent?: string;
  role: "user" | "assistant";
  timestamp: Date;
  toolResults?: ToolCallResult[];
}

export interface Conversation {
  _id: Id<"aiConversations">;
  title: string;
  updatedAt: number;
  createdAt: number;
}

export interface ToolCall {
  id: string;
  name: string;
  parameters: Record<string, unknown>;
  status: "calling" | "executing" | "completed" | "error";
  result?: unknown;
  streamingResult?: string;
  error?: string;
}

export type AgentStreamEvent =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; delta: string }
  | { type: "tool-result-delta"; toolCallId: string; delta: string }
  | { type: "tool-call-result"; toolCallId: string; result: unknown }
  | { type: "finish"; model: string; usage: null }
  | { type: "error"; message: string };
