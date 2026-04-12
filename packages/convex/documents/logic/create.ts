import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 创建新文档
 * @param title 文档标题
 * @param parentDocument 可选，父文档ID
 * @returns 创建的文档
 */
export const create = mutation({
  args: {
    title: v.string(),
    parentDocument: v.optional(v.id("documents")),
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
      isStarred: false,
      lastEditedTime: Date.now(),
    });

    return document;
  },
});
