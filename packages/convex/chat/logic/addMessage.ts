import { mutation } from "@convex/server";
import { v } from "convex/values";

/**
 * 添加消息到对话
 */
export const addMessage = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    documentId: v.optional(v.id("documents")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const messageId = await ctx.db.insert("aiMessages", {
      conversationId: args.conversationId,
      content: args.content,
      role: args.role,
      createdAt: now,
      documentId: args.documentId,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return messageId;
  },
});
