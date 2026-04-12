import { query } from "@convex/server";
import { v } from "convex/values";

/**
 * 获取用户的所有AI对话
 */
export const getConversations = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiConversations")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});
