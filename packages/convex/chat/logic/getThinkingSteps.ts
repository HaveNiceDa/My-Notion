import { query } from "@convex/server";
import { v } from "convex/values";

/**
 * 获取对话的思考过程步骤
 */
export const getThinkingSteps = query({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiThinkingSteps")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("asc")
      .collect();
  },
});
