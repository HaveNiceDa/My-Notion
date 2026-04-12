import { query } from "@convex/server";

/**
 * 获取搜索文档列表（未归档的文档）
 * @returns 未归档的文档列表，按创建时间倒序排列
 */
export const getSearch = query({
  handler: async (context) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const documents = await context.db
      .query("documents")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("isArchived"), false))
      .order("desc")
      .collect();

    return documents;
  },
});
