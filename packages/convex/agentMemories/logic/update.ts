import { mutation } from "@convex/server";
import { v } from "convex/values";
import {
  clampScore,
  deriveMemoryDefaults,
  memoryCategoryValidator,
  memoryEmbeddingStatusValidator,
  memoryKindValidator,
  memoryPrivacyValidator,
  memoryScopeLevelValidator,
  memoryStabilityValidator,
  memoryTypeValidator,
} from "../model";

export const updateAgentMemory = mutation({
  args: {
    memoryId: v.id("agentMemories"),
    type: memoryTypeValidator,
    content: v.string(),
    reason: v.optional(v.string()),
    summary: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    kind: v.optional(memoryKindValidator),
    category: v.optional(memoryCategoryValidator),
    scopeLevel: v.optional(memoryScopeLevelValidator),
    scopeKey: v.optional(v.string()),
    evidenceConversationId: v.optional(v.id("aiConversations")),
    evidenceMessageId: v.optional(v.id("aiMessages")),
    evidenceDocumentId: v.optional(v.id("documents")),
    evidenceToolCallId: v.optional(v.string()),
    evidenceText: v.optional(v.string()),
    evidenceUrl: v.optional(v.string()),
    confidence: v.optional(v.number()),
    importance: v.optional(v.number()),
    stability: v.optional(memoryStabilityValidator),
    privacy: v.optional(memoryPrivacyValidator),
    expiresAt: v.optional(v.number()),
    reviewDueAt: v.optional(v.number()),
    embeddingStatus: v.optional(memoryEmbeddingStatusValidator),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== identity.subject || memory.status !== "active") {
      throw new Error("Memory not found");
    }

    const content = args.content.trim();
    if (!content) {
      throw new Error("content is required");
    }

    const now = Date.now();
    const defaults = deriveMemoryDefaults(args.type, identity.subject);
    const confidence = clampScore(args.confidence, 1);
    const importance = clampScore(args.importance, memory.importance ?? defaults.importance);
    await ctx.db.patch(args.memoryId, {
      type: args.type,
      kind: args.kind ?? memory.kind ?? defaults.kind,
      category: args.category?.trim() || memory.category || defaults.category,
      scopeLevel: args.scopeLevel ?? memory.scopeLevel ?? defaults.scopeLevel,
      scopeKey: args.scopeKey?.trim() || memory.scopeKey || defaults.scopeKey,
      content,
      reason: args.reason?.trim() || undefined,
      ...(args.summary !== undefined ? { summary: args.summary.trim() || undefined } : {}),
      ...(args.tags !== undefined ? { tags: normalizeTags(args.tags) } : {}),
      ...(args.evidenceConversationId !== undefined
        ? { evidenceConversationId: args.evidenceConversationId }
        : {}),
      ...(args.evidenceMessageId !== undefined ? { evidenceMessageId: args.evidenceMessageId } : {}),
      ...(args.evidenceDocumentId !== undefined ? { evidenceDocumentId: args.evidenceDocumentId } : {}),
      ...(args.evidenceToolCallId !== undefined
        ? { evidenceToolCallId: args.evidenceToolCallId.trim() || undefined }
        : {}),
      ...(args.evidenceText !== undefined ? { evidenceText: args.evidenceText.trim() || undefined } : {}),
      ...(args.evidenceUrl !== undefined ? { evidenceUrl: args.evidenceUrl.trim() || undefined } : {}),
      confidence,
      importance,
      stability: args.stability ?? memory.stability ?? defaults.stability,
      privacy: args.privacy ?? memory.privacy ?? defaults.privacy,
      expiresAt: args.expiresAt,
      reviewDueAt: args.reviewDueAt,
      embeddingStatus: args.embeddingStatus ?? "pending",
      embeddingRetryCount: memory.embeddingRetryCount ?? defaults.embeddingRetryCount,
      updatedAt: now,
    });

    return {
      id: args.memoryId,
      type: args.type,
      kind: args.kind ?? memory.kind ?? defaults.kind,
      category: args.category?.trim() || memory.category || defaults.category,
      scopeLevel: args.scopeLevel ?? memory.scopeLevel ?? defaults.scopeLevel,
      scopeKey: args.scopeKey?.trim() || memory.scopeKey || defaults.scopeKey,
      content,
      source: memory.source,
      reason: args.reason,
      summary: args.summary,
      tags: normalizeTags(args.tags),
      confidence,
      importance,
      stability: args.stability ?? memory.stability ?? defaults.stability,
      privacy: args.privacy ?? memory.privacy ?? defaults.privacy,
      expiresAt: args.expiresAt,
      reviewDueAt: args.reviewDueAt,
      embeddingStatus: args.embeddingStatus ?? "pending",
      embeddingRetryCount: memory.embeddingRetryCount ?? defaults.embeddingRetryCount,
      updatedAt: now,
    };
  },
});

function normalizeTags(tags: string[] | undefined): string[] | undefined {
  const normalized = (tags ?? [])
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  return normalized.length > 0 ? normalized : undefined;
}
