import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 删除文档
 * @param id 文档ID
 * @returns 删除的文档
 */
export const remove = mutation({
  args: { id: v.id("documents") },
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

    const document = await context.db.delete(args.id);

    return document;
  },
});
