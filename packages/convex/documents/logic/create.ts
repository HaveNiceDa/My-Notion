import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 创建新文档
 * @param title 文档标题
 * @param parentDocument 可选，父文档ID
 * @param isStarred 可选，创建时是否收藏
 * @param isInKnowledgeBase 可选，创建时是否加入知识库
 * @returns 创建的文档
 */
export const create = mutation({
  args: {
    title: v.string(),
    parentDocument: v.optional(v.id("documents")),
    isStarred: v.optional(v.boolean()),
    isInKnowledgeBase: v.optional(v.boolean()),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const document = await context.db.insert("documents", {
      title: args.title,
      parentDocument: args.parentDocument,
      userId,
      isArchived: false,
      isPublished: false,
      // 允许客户端在创建时写入初始分区状态，避免 create -> update 两段式导致列表短暂抖动。
      isStarred: args.isStarred ?? false,
      isInKnowledgeBase: args.isInKnowledgeBase ?? true,
      lastEditedTime: Date.now(),
    });

    return document;
  },
});
