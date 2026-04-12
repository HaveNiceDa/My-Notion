import { defineTable } from "convex/server";
import { v } from "convex/values";

/** 对话消息表 */
export const aiMessagesTable = defineTable({
  /** 对话ID */
  conversationId: v.id("aiConversations"),
  /** 消息内容 */
  content: v.string(),
  /** 角色：user 或 assistant */
  role: v.union(v.literal("user"), v.literal("assistant")),
  /** 创建时间 */
  createdAt: v.number(),
  /** 关联的文档ID（可选） */
  documentId: v.optional(v.id("documents")),
}).index("by_conversation", ["conversationId"]);
