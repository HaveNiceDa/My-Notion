import { mutation } from "@convex/server";
import { v } from "convex/values";

export const deleteConversation = mutation({
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

    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    await ctx.db.delete(args.conversationId);
    return true;
  },
});
