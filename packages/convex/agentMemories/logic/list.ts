import { query } from "@convex/server";
import { v } from "convex/values";
import { deriveMemoryDefaults, memoryTypeValidator } from "../model";

function normalizeQuery(value: string | undefined): string[] {
  return (value ?? "")
    .toLowerCase()
    .split(/[\s,，.。:：;；/\\()[\]{}'"`]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .slice(0, 12);
}

export const listAgentMemories = query({
  args: {
    query: v.optional(v.string()),
    type: v.optional(memoryTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const now = Date.now();
    const limit = Math.min(Math.max(Math.floor(args.limit ?? 8), 1), 100);
    const baseQuery = args.type
      ? ctx.db
        .query("agentMemories")
        .withIndex("by_user_type_and_status", (q) =>
          q.eq("userId", identity.subject).eq("type", args.type!).eq("status", "active"),
        )
      : ctx.db
        .query("agentMemories")
        .withIndex("by_user_and_status", (q) =>
          q.eq("userId", identity.subject).eq("status", "active"),
        );

    const memories = await baseQuery.collect();
    const tokens = normalizeQuery(args.query);

    return memories
      .filter((memory) => !memory.expiresAt || memory.expiresAt > now)
      .map((memory) => {
        const defaults = deriveMemoryDefaults(memory.type, identity.subject);
        const kind = memory.kind ?? defaults.kind;
        const category = memory.category ?? defaults.category;
        const text = `${memory.type} ${kind} ${category} ${memory.content} ${memory.reason ?? ""}`
          .toLowerCase();
        const matchScore = tokens.length === 0
          ? 1
          : tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
        return { memory, matchScore, defaults, kind, category };
      })
      .filter(({ matchScore }) => tokens.length === 0 || matchScore > 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return b.memory.updatedAt - a.memory.updatedAt;
      })
      .slice(0, limit)
      .map(({ memory, matchScore, defaults, kind, category }) => ({
        id: memory._id,
        type: memory.type,
        kind,
        category,
        scopeLevel: memory.scopeLevel ?? defaults.scopeLevel,
        scopeKey: memory.scopeKey ?? defaults.scopeKey,
        content: memory.content,
        source: memory.source,
        reason: memory.reason,
        summary: memory.summary,
        tags: memory.tags,
        evidenceConversationId: memory.evidenceConversationId,
        evidenceMessageId: memory.evidenceMessageId,
        evidenceDocumentId: memory.evidenceDocumentId,
        evidenceToolCallId: memory.evidenceToolCallId,
        evidenceText: memory.evidenceText,
        evidenceUrl: memory.evidenceUrl,
        confidence: memory.confidence,
        importance: memory.importance ?? defaults.importance,
        stability: memory.stability ?? defaults.stability,
        privacy: memory.privacy ?? defaults.privacy,
        status: memory.status,
        supersededBy: memory.supersededBy,
        supersedes: memory.supersedes,
        conflictsWith: memory.conflictsWith,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        expiresAt: memory.expiresAt,
        reviewDueAt: memory.reviewDueAt,
        lastUsedAt: memory.lastUsedAt,
        usageCount: memory.usageCount ?? defaults.usageCount,
        embeddingRef: memory.embeddingRef,
        embeddingStatus: memory.embeddingStatus ?? defaults.embeddingStatus,
        embeddingUpdatedAt: memory.embeddingUpdatedAt,
        embeddingError: memory.embeddingError,
        embeddingRetryCount: memory.embeddingRetryCount ?? defaults.embeddingRetryCount,
        nextEmbeddingRetryAt: memory.nextEmbeddingRetryAt,
        matchScore,
      }));
  },
});
