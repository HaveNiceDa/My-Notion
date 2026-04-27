import { mutation } from "@convex/server";
import { v } from "convex/values";

export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    title: v.string(),
  },
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

    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return true;
  },
});
