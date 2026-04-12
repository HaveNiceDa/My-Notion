import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 切换文档收藏状态
 * @param id 文档ID
 * @param isStarred 是否收藏
 * @returns 更新后的文档
 */
export const toggleStar = mutation({
  args: { id: v.id("documents"), isStarred: v.boolean() },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const existingDocument = await context.db.get(args.id);

    if (!existingDocument) {
      throw new Error("Not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const document = await context.db.patch(args.id, {
      isStarred: args.isStarred,
      lastEditedTime: Date.now(),
    });

    return document;
  },
});
