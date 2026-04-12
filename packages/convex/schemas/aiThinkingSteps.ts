import { defineTable } from "convex/server";
import { v } from "convex/values";

/** AI思考步骤表 */
export const aiThinkingStepsTable = defineTable({
  /** 对话ID */
  conversationId: v.id("aiConversations"),
  /** 消息ID（可选，关联到assistant消息） */
  messageId: v.optional(v.id("aiMessages")),
  /** 步骤类型 */
  type: v.string(),
  /** 步骤内容 */
  content: v.string(),
  /** 步骤详情 */
  details: v.optional(v.string()),
  /** 创建时间 */
  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId"])
  .index("by_message", ["messageId"]);
