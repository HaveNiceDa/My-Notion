import { query } from "@convex/server";

/**
 * 获取知识库文档列表
 * @returns 知识库中的文档列表，按创建时间倒序排列
 */
export const getKnowledgeBaseDocuments = query({
  args: {},
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const documents = await context.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isArchived"), false),
          q.eq(q.field("isInKnowledgeBase"), true),
        ),
      )
      .order("desc")
      .collect();

    return documents;
  },
});
