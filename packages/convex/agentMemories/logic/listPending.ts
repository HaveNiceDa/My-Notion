import { query } from "@convex/server";
import { v } from "convex/values";
import { deriveMemoryDefaults } from "../model";

export const listPendingAgentMemories = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const limit = Math.min(Math.max(Math.floor(args.limit ?? 50), 1), 100);
    const memories = await ctx.db
      .query("agentMemories")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", identity.subject).eq("status", "pending_review"),
      )
      .order("desc")
      .take(limit);

    return memories.map((memory) => {
      const defaults = deriveMemoryDefaults(memory.type, identity.subject);
      return {
        id: memory._id,
        type: memory.type,
        kind: memory.kind ?? defaults.kind,
        category: memory.category ?? defaults.category,
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
        conflictsWith: memory.conflictsWith,
        createdAt: memory.createdAt,
        updatedAt: memory.updatedAt,
        expiresAt: memory.expiresAt,
        reviewDueAt: memory.reviewDueAt,
        embeddingStatus: memory.embeddingStatus ?? defaults.embeddingStatus,
      };
    });
  },
});
