import { mutation } from "@convex/server";
import { v } from "convex/values";

export const deleteThinkingSteps = mutation({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const userId = identity.subject;

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    if (conversation.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const steps = await ctx.db
      .query("aiThinkingSteps")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const step of steps) {
      await ctx.db.delete(step._id);
    }

    return steps.length;
  },
});
