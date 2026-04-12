import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 更新文档信息
 * @param id 文档ID
 * @param title 可选，文档标题
 * @param content 可选，文档内容
 * @param coverImage 可选，封面图片URL
 * @param icon 可选，文档图标
 * @param isPublished 可选，是否发布
 * @param isStarred 可选，是否收藏
 * @returns 更新后的文档
 */
export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    coverImage: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublished: v.optional(v.boolean()),
    isStarred: v.optional(v.boolean()),
    isInKnowledgeBase: v.optional(v.boolean()),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const userId = identity.subject;

    const { id, ...rest } = args;

    const existingDocument = await context.db.get(args.id);

    if (!existingDocument) {
      throw new Error("Not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const document = await context.db.patch(args.id, {
      ...rest,
      lastEditedTime: Date.now(),
    });

    return document;
  },
});
