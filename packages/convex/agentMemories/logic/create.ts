import { mutation } from "@convex/server";
import { v } from "convex/values";

const memoryTypeValidator = v.union(
  v.literal("preference"),
  v.literal("project"),
  v.literal("episodic"),
);

const memorySourceValidator = v.union(
  v.literal("user_explicit"),
  v.literal("agent_proposed"),
  v.literal("manual"),
);

export const createAgentMemory = mutation({
  args: {
    type: memoryTypeValidator,
    content: v.string(),
    source: memorySourceValidator,
    reason: v.optional(v.string()),
    confidence: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
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
    const memoryId = await ctx.db.insert("agentMemories", {
      userId: identity.subject,
      type: args.type,
      content,
      source: args.source,
      reason: args.reason?.trim() || undefined,
      confidence: clampConfidence(args.confidence),
      status: "active",
      expiresAt: args.expiresAt,
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
    }

    return {
      id: memoryId,
      type: args.type,
      content,
      source: args.source,
      reason: args.reason,
      confidence: clampConfidence(args.confidence),
      createdAt: now,
      updatedAt: now,
      expiresAt: args.expiresAt,
    };
  },
});

function clampConfidence(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 1;
  }
  return Math.min(Math.max(value, 0), 1);
}
