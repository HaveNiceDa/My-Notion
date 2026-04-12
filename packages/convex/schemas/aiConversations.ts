import { defineTable } from "convex/server";
import { v } from "convex/values";

/** AI对话表 */
export const aiConversationsTable = defineTable({
  /** 用户ID */
  userId: v.string(),
  /** 对话标题 */
  title: v.string(),
  /** 创建时间 */
  createdAt: v.number(),
  /** 更新时间 */
  updatedAt: v.number(),
}).index("by_user", ["userId"]);
