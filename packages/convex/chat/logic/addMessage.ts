import { mutation } from "@convex/server";
import { v } from "convex/values";

export const addMessage = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    content: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    documentId: v.optional(v.id("documents")),
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
