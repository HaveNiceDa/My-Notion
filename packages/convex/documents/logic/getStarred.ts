import { query } from "@convex/server";

/**
 * 获取收藏的文档列表
 * @returns 收藏的文档列表，按创建时间倒序排列
 */
export const getStarred = query({
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
          q.eq(q.field("isStarred"), true),
        ),
      )
      .order("desc")
      .collect();

    return documents;
  },
});
