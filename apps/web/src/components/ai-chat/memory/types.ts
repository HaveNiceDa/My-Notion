import type { Id } from "@/convex/_generated/dataModel";

export type MemoryType = "preference" | "project" | "episodic";
export type MemoryKind = "instruction" | "semantic" | "episodic" | "procedural";
export type MemorySource = "user_explicit" | "agent_proposed" | "manual" | "auto_extracted" | "system";
export type MemoryPrivacy = "normal" | "sensitive";
export type MemoryEmbeddingStatus = "pending" | "synced" | "failed" | "skipped";

export interface AgentMemoryItem {
  id: Id<"agentMemories">;
  type: MemoryType;
  kind?: MemoryKind | string;
  category?: string;
  scopeLevel?: string;
  scopeKey?: string;
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
  importance?: number;
  stability?: string;
  privacy?: MemoryPrivacy | string;
  status?: string;
  conflictsWith?: Id<"agentMemories">[];
  supersedes?: Id<"agentMemories">[];
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
  reviewDueAt?: number;
  lastUsedAt?: number;
  usageCount?: number;
  embeddingStatus?: MemoryEmbeddingStatus | string;
  embeddingUpdatedAt?: number;
  embeddingError?: string;
}

export interface MemoryEditState {
  type: MemoryType;
  content: string;
  reason: string;
  confidence: string;
}

export type ActiveSort = "updated_desc" | "importance_desc" | "usage_desc" | "review_due";

export interface ActiveMemoryFilters {
  query: string;
  type: "all" | MemoryType;
  kind: "all" | MemoryKind;
  embeddingStatus: "all" | MemoryEmbeddingStatus;
  privacy: "all" | MemoryPrivacy;
  sort: ActiveSort;
}
