import type { Id } from "@/convex/_generated/dataModel";

export type MemoryType = "preference" | "project" | "episodic";
export type MemorySource = "user_explicit" | "agent_proposed" | "manual" | "auto_extracted" | "system";

export interface AgentMemoryItem {
  id: Id<"agentMemories">;
  type: MemoryType;
  content: string;
  summary?: string;
  tags?: string[];
  source: MemorySource;
  reason?: string;
  evidenceConversationId?: Id<"aiConversations">;
  evidenceMessageId?: Id<"aiMessages">;
  evidenceDocumentId?: Id<"documents">;
  evidenceToolCallId?: string;
  evidenceText?: string;
  evidenceUrl?: string;
  confidence: number;
  status?: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryEditState {
  type: MemoryType;
  content: string;
  reason: string;
}

export interface ActiveMemoryFilters {
  query: string;
  type: "all" | MemoryType;
}
