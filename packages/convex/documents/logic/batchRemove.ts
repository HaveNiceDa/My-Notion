import { v } from "convex/values";
import { mutation } from "@convex/server";

/**
 * 批量删除文档
 * @param ids 文档ID数组
 * @returns 删除的文档数量
 */
export const batchRemove = mutation({
  args: { ids: v.array(v.id("documents")) },
  handler: async (context, args) => {
    const identity = await context.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    let deletedCount = 0;

    for (const id of args.ids) {
      const existingDocument = await context.db.get(id);

      if (existingDocument && existingDocument.userId === userId) {
        await context.db.delete(id);
        deletedCount++;
      }
    }

    return deletedCount;
  },
});
