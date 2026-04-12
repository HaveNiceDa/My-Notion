import { mutation } from "@convex/server";
import { v } from "convex/values";

/**
 * 更新对话标题
 */
export const updateConversationTitle = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.conversationId, {
      title: args.title,
      updatedAt: Date.now(),
    });
    return true;
  },
});
