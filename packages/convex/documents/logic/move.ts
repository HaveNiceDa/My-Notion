import { v } from "convex/values";
import { mutation } from "@convex/server";
import { Doc, Id } from "@convex/dataModel";

/**
 * 移动文档（更改父文档）
 * @param id 文档ID
 * @param parentDocument 可选，新的父文档ID
 * @returns 更新后的文档
 */
export const move = mutation({
  args: {
    id: v.id("documents"),
    parentDocument: v.optional(v.id("documents")),
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

    // 防止循环移动（将文档移动到自己的子文档中）
    if (args.parentDocument) {
      let currentParent: Id<"documents"> | undefined = args.parentDocument;
      while (currentParent) {
        const parentDoc: Doc<"documents"> | null =
          await context.db.get(currentParent);
        if (!parentDoc) break;
        if (parentDoc._id === args.id) {
          throw new Error("Cannot move document into its own subtree");
        }
        currentParent = parentDoc.parentDocument;
      }
    }

    const document = await context.db.patch(args.id, {
      parentDocument: args.parentDocument,
    });

    return document;
  },
});
