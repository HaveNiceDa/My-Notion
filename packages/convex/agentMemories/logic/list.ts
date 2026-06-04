import { query } from "@convex/server";
import { v } from "convex/values";
import { memoryTypeValidator } from "../model";

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
      .map((memory) => {
        const text = `${memory.type} ${memory.content} ${memory.summary ?? ""} ${memory.reason ?? ""}`
          .toLowerCase();
        const matchScore = tokens.length === 0
          ? 1
          : tokens.reduce((score, token) => score + (text.includes(token) ? 1 : 0), 0);
        return { memory, matchScore };
      })
      .filter(({ matchScore }) => tokens.length === 0 || matchScore > 0)
      .sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return b.memory.updatedAt - a.memory.updatedAt;
      })
      .slice(0, limit)
      .map(({ memory, matchScore }) => ({
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
        matchScore,
      }));
  },
});
