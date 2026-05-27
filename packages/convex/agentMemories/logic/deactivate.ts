import { mutation } from "@convex/server";
import { v } from "convex/values";

export const deactivateAgentMemory = mutation({
  args: {
    memoryId: v.id("agentMemories"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const memory = await ctx.db.get(args.memoryId);
    if (!memory || memory.userId !== identity.subject) {
      throw new Error("Memory not found");
    }

    const now = Date.now();
    await ctx.db.patch(args.memoryId, {
      status: "deleted",
      updatedAt: now,
    });

    return {
      id: args.memoryId,
      status: "deleted",
      updatedAt: now,
    };
  },
});
