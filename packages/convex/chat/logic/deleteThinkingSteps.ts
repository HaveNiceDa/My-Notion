import { mutation } from "@convex/server";
import { v } from "convex/values";

/**
 * 删除对话的所有思考过程步骤
 */
export const deleteThinkingSteps = mutation({
  args: { conversationId: v.id("aiConversations") },
  handler: async (ctx, args) => {
    // 获取对话的所有思考过程步骤
    const steps = await ctx.db
      .query("aiThinkingSteps")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .collect();

    // 删除所有步骤
    for (const step of steps) {
      await ctx.db.delete(step._id);
    }

    return steps.length;
  },
});
