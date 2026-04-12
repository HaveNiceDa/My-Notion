import { mutation } from "@convex/server";
import { v } from "convex/values";

/**
 * 创建新对话
 */
export const createConversation = mutation({
  args: { userId: v.string(), title: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("aiConversations", {
      userId: args.userId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});
