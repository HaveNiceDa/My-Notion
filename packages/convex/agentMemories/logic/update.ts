import { mutation } from "@convex/server";
import { v } from "convex/values";

const memoryTypeValidator = v.union(
  v.literal("preference"),
  v.literal("project"),
  v.literal("episodic"),
);

export const updateAgentMemory = mutation({
  args: {
    memoryId: v.id("agentMemories"),
    type: memoryTypeValidator,
    content: v.string(),
    reason: v.optional(v.string()),
    confidence: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
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
    await ctx.db.patch(args.memoryId, {
      type: args.type,
      content,
      reason: args.reason?.trim() || undefined,
      confidence: clampConfidence(args.confidence),
      expiresAt: args.expiresAt,
      updatedAt: now,
    });

    return {
      id: args.memoryId,
      type: args.type,
      content,
      source: memory.source,
      reason: args.reason,
      confidence: clampConfidence(args.confidence),
      expiresAt: args.expiresAt,
      updatedAt: now,
    };
  },
});

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(value, 0), 1);
}
