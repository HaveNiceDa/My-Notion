import { v } from "convex/values";
import { query } from "@convex/server";

/**
 * 获取用户所有未归档的文档（用于前端构建树结构）
 */
export const getAllSidebarDocuments = query({
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
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();

    return documents;
  },
});
