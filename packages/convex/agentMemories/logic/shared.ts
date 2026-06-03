import type { Id } from "@convex/dataModel";
import {
  clampScore,
  deriveMemoryDefaults,
  type LegacyMemoryType,
  type MemoryEmbeddingStatus,
  type MemoryKind,
  type MemoryPrivacy,
  type MemoryScopeLevel,
  type MemoryStability,
} from "../model";

export interface MemoryWriteInput {
  type: LegacyMemoryType;
  content: string;
  reason?: string;
  summary?: string;
  tags?: string[];
  kind?: MemoryKind;
  category?: string;
  scopeLevel?: MemoryScopeLevel;
  scopeKey?: string;
  evidenceConversationId?: Id<"aiConversations">;
  evidenceMessageId?: Id<"aiMessages">;
  evidenceDocumentId?: Id<"documents">;
  evidenceToolCallId?: string;
  evidenceText?: string;
  evidenceUrl?: string;
  confidence?: number;
  importance?: number;
  stability?: MemoryStability;
  privacy?: MemoryPrivacy;
  expiresAt?: number;
  reviewDueAt?: number;
  embeddingStatus?: MemoryEmbeddingStatus;
}

export function buildMemoryPatch(input: MemoryWriteInput, userId: string) {
  const content = input.content.trim();
  if (!content) {
    throw new Error("content is required");
  }

  const defaults = deriveMemoryDefaults(input.type, userId);
  return {
    type: input.type,
    kind: input.kind ?? defaults.kind,
    category: input.category?.trim() || defaults.category,
    scopeLevel: input.scopeLevel ?? defaults.scopeLevel,
    scopeKey: input.scopeKey?.trim() || defaults.scopeKey,
    content,
    reason: input.reason?.trim() || undefined,
    summary: input.summary?.trim() || undefined,
    tags: normalizeTags(input.tags),
    evidenceConversationId: input.evidenceConversationId,
    evidenceMessageId: input.evidenceMessageId,
    evidenceDocumentId: input.evidenceDocumentId,
    evidenceToolCallId: input.evidenceToolCallId?.trim() || undefined,
    evidenceText: input.evidenceText?.trim() || undefined,
    evidenceUrl: input.evidenceUrl?.trim() || undefined,
    confidence: clampScore(input.confidence, 1),
    importance: clampScore(input.importance, defaults.importance),
    stability: input.stability ?? defaults.stability,
    privacy: input.privacy ?? defaults.privacy,
    expiresAt: input.expiresAt,
    reviewDueAt: input.reviewDueAt,
    usageCount: defaults.usageCount,
    embeddingStatus: input.embeddingStatus ?? defaults.embeddingStatus,
    embeddingRetryCount: defaults.embeddingRetryCount,
  };
}

export function normalizeTags(tags: string[] | undefined): string[] | undefined {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  return normalized.length > 0 ? normalized : undefined;
}

export function contentOverlapScore(left: string, right: string): number {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.length === 0 || rightTokens.length === 0) return 0;
  const rightSet = new Set(rightTokens);
  const intersection = leftTokens.filter((token) => rightSet.has(token)).length;
  return intersection / Math.max(leftTokens.length, rightTokens.length);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[\s,，.。:：;；/\\()[\]{}'"`!?！？]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 80);
}
