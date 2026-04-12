import { v } from "convex/values";
import { query } from "@convex/server";
import { Doc } from "@convex/dataModel";

/**
 * 获取文档路径（从根文档到当前文档的路径）
 * @param documentId 文档ID
 * @returns 文档路径数组，按从根到当前的顺序排列
 */
export const getDocumentPath = query({
  args: { documentId: v.id("documents") },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;

    const path: Doc<"documents">[] = [];
    let currentDocument: Doc<"documents"> | null | undefined =
      await context.db.get(args.documentId);

    if (!currentDocument) {
      throw new Error("Not found");
    }

    if (currentDocument.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // 从当前文档向上遍历，构建路径
    while (currentDocument) {
      path.unshift(currentDocument);
      if (currentDocument.parentDocument) {
        currentDocument = await context.db.get(currentDocument.parentDocument);
      } else {
        break;
      }
    }

    return path;
  },
});
