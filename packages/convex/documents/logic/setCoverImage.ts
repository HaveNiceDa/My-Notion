import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 设置文档封面图片（通过 Convex Storage ID）
 */
export const setCoverImage = mutation({
  args: {
    id: v.id("documents"),
    storageId: v.id("_storage"),
  },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const userId = identity.subject;
    const existingDocument = await context.db.get(args.id);

    if (!existingDocument) {
      throw new Error("Not found");
    }

    if (existingDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    if (
      existingDocument.coverImageStorageId &&
      existingDocument.coverImageStorageId !== args.storageId
    ) {
      await context.storage.delete(existingDocument.coverImageStorageId);
    }

    const document = await context.db.patch(args.id, {
      coverImageStorageId: args.storageId,
      coverImage: undefined,
      lastEditedTime: Date.now(),
    });

    return document;
  },
});
