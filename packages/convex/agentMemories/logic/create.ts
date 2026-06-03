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
  memorySourceValidator,
  memoryStabilityValidator,
  memoryTypeValidator,
} from "../model";

export const createAgentMemory = mutation({
  args: {
    type: memoryTypeValidator,
    content: v.string(),
    source: memorySourceValidator,
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
    supersedesMemoryId: v.optional(v.id("agentMemories")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const content = args.content.trim();
    if (!content) {
      throw new Error("content is required");
    }

    const now = Date.now();
    const defaults = deriveMemoryDefaults(args.type, identity.subject);
    const confidence = clampScore(args.confidence, 1);
    const importance = clampScore(args.importance, defaults.importance);
    const memoryId = await ctx.db.insert("agentMemories", {
      userId: identity.subject,
      type: args.type,
      kind: args.kind ?? defaults.kind,
      category: args.category?.trim() || defaults.category,
      scopeLevel: args.scopeLevel ?? defaults.scopeLevel,
      scopeKey: args.scopeKey?.trim() || defaults.scopeKey,
      content,
      source: args.source,
      reason: args.reason?.trim() || undefined,
      summary: args.summary?.trim() || undefined,
      tags: normalizeTags(args.tags),
      evidenceConversationId: args.evidenceConversationId,
      evidenceMessageId: args.evidenceMessageId,
      evidenceDocumentId: args.evidenceDocumentId,
      evidenceToolCallId: args.evidenceToolCallId?.trim() || undefined,
      evidenceText: args.evidenceText?.trim() || undefined,
      evidenceUrl: args.evidenceUrl?.trim() || undefined,
      confidence,
      importance,
      stability: args.stability ?? defaults.stability,
      privacy: args.privacy ?? defaults.privacy,
      status: "active",
      expiresAt: args.expiresAt,
      reviewDueAt: args.reviewDueAt,
      usageCount: defaults.usageCount,
      embeddingStatus: args.embeddingStatus ?? defaults.embeddingStatus,
      embeddingRetryCount: defaults.embeddingRetryCount,
      createdAt: now,
      updatedAt: now,
    });

    if (args.supersedesMemoryId) {
      const oldMemory = await ctx.db.get(args.supersedesMemoryId);
      if (!oldMemory || oldMemory.userId !== identity.subject) {
        throw new Error("Memory to supersede not found");
      }
      await ctx.db.patch(args.supersedesMemoryId, {
        status: "superseded",
        supersededBy: memoryId,
        updatedAt: now,
      });
      await ctx.db.patch(memoryId, {
        supersedes: [args.supersedesMemoryId],
        updatedAt: now,
      });
    }

    return {
      id: memoryId,
      type: args.type,
      kind: args.kind ?? defaults.kind,
      category: args.category?.trim() || defaults.category,
      scopeLevel: args.scopeLevel ?? defaults.scopeLevel,
      scopeKey: args.scopeKey?.trim() || defaults.scopeKey,
      content,
      source: args.source,
      reason: args.reason,
      summary: args.summary,
      tags: normalizeTags(args.tags),
      confidence,
      importance,
      stability: args.stability ?? defaults.stability,
      privacy: args.privacy ?? defaults.privacy,
      status: "active",
      createdAt: now,
      updatedAt: now,
      expiresAt: args.expiresAt,
      reviewDueAt: args.reviewDueAt,
      usageCount: defaults.usageCount,
      embeddingStatus: args.embeddingStatus ?? defaults.embeddingStatus,
      embeddingRetryCount: defaults.embeddingRetryCount,
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
