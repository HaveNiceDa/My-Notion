import { v } from "convex/values";
import { query } from "@convex/server";

/**
 * 根据ID获取文档
 * @param documentId 文档ID
 * @returns 文档信息
 */
export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    const document = await context.db.get(args.documentId);

    if (!document) {
      throw new Error("Not found");
    }

    if (document.isPublished && !document.isArchived) {
      return document;
    }

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    if (document.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return document;
  },
});
