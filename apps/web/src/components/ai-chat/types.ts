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

export interface SendMessageOptions {
  images?: string[];
}
