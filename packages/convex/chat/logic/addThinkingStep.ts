import { mutation } from "@convex/server";
import { v } from "convex/values";

/**
 * 添加思考过程步骤
 */
export const addThinkingStep = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    messageId: v.optional(v.id("aiMessages")),
    type: v.string(),
    content: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
