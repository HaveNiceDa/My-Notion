import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 移除文档图标
 * @param id 文档ID
 * @returns 更新后的文档
 */
export const removeIcon = mutation({
  args: { id: v.id("documents") },
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

    const document = await context.db.patch(args.id, {
      icon: undefined,
    });

    return document;
  },
});
