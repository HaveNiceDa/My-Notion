import { query } from "@convex/server";
import { v } from "convex/values";

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

    return memories.map((memory) => ({
      id: memory._id,
      type: memory.type,
      content: memory.content,
      source: memory.source,
      reason: memory.reason,
      summary: memory.summary,
      tags: memory.tags,
      evidenceText: memory.evidenceText,
      confidence: memory.confidence,
      status: memory.status,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    }));
  },
});
