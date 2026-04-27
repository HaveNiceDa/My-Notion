import { mutation } from "@convex/server";
import { v } from "convex/values";

export const addThinkingStep = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    messageId: v.optional(v.id("aiMessages")),
    type: v.string(),
    content: v.string(),
    details: v.optional(v.string()),
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

    const now = Date.now();
    return await ctx.db.insert("aiThinkingSteps", {
      conversationId: args.conversationId,
      messageId: args.messageId,
      type: args.type,
      content: args.content,
      details: args.details,
      createdAt: now,
    });
  },
});
