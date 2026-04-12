import { query } from "@convex/server";
import { v } from "convex/values";

/**
 * 获取用户知识库文档（用于RAG处理）
 */
export const getKnowledgeBaseDocumentsForRAG = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isInKnowledgeBase"), true),
        ),
      )
      .collect();
  },
});
