import { v } from "convex/values";
import { query } from "@convex/server";

/**
 * 根据ID获取文档
 * @param documentId 文档ID
 * @returns 文档信息（含 coverImageStorageId → URL 水合）
 */
export const getById = query({
  args: { documentId: v.id("documents") },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    const document = await context.db.get(args.documentId);

    if (!document) {
      throw new Error("Not found");
    }

    const coverImage = document.coverImageStorageId
      ? await context.storage.getUrl(document.coverImageStorageId)
      : document.coverImage;

    const hydratedDocument = {
      ...document,
      coverImage: coverImage ?? document.coverImage,
    };

    if (document.isPublished && !document.isArchived) {
      return hydratedDocument;
    }

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    if (document.userId !== userId) {
      throw new Error("Unauthorized");
    }

    return hydratedDocument;
  },
});
