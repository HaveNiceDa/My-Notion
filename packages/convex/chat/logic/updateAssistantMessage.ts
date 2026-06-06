import { mutation } from "@convex/server";
import { v } from "convex/values";

export const updateAssistantMessage = mutation({
  args: {
    messageId: v.id("aiMessages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message || message.role !== "assistant") {
      throw new Error("Message not found");
    }

    const conversation = await ctx.db.get(message.conversationId);
    if (!conversation || conversation.userId !== identity.subject) {
      throw new Error("Unauthorized");
    }

    const now = Date.now();
    await ctx.db.patch(args.messageId, {
      content: args.content,
    });
    await ctx.db.patch(message.conversationId, {
      updatedAt: now,
    });

    return { id: args.messageId };
  },
});
