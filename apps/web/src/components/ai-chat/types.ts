import type { Id } from "@/convex/_generated/dataModel";
import type { AIModelId, ChatMode } from "./models";

export interface ChatMessage {
  id: string;
  content: string;
  reasoningContent?: string;
  role: "user" | "assistant";
  timestamp: Date;
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
  error?: string;
}

export type AgentStreamEvent =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; delta: string }
  | { type: "tool-call-result"; toolCallId: string; result: unknown }
  | { type: "finish"; model: string; usage: null }
  | { type: "error"; message: string };
