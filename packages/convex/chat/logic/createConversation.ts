import { mutation } from "@convex/server";
import { v } from "convex/values";

export const createConversation = mutation({
  args: { title: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }
    const userId = identity.subject;
    const now = Date.now();
    return await ctx.db.insert("aiConversations", {
      userId,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});
