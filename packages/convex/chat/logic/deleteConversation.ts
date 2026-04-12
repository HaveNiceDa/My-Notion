import { mutation } from "@convex/server";
import { v } from "convex/values";

/**
 * 删除对话
 */
export const deleteConversation = mutation({
  args: { conversationId: v.id("aiConversations"), userId: v.string() },
  handler: async (ctx, args) => {
    const userId = args.userId;

    // 获取对话信息
    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // 验证用户权限
    if (conversation.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // 删除对话的所有消息
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // 删除对话本身
    await ctx.db.delete(args.conversationId);
    return true;
  },
});
