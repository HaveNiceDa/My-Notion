import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * 与 `packages/convex/schemas` 保持一致；在此处内联是为了让 `defineTable` / `defineSchema`
 * 与 `documents.ts` 等函数引用同一套 `convex/server` 类型，避免跨包重复解析 convex 导致的
 * `DataModel` 推断失败（表现为 `db` 上字段全部为 `never`）。
 *
 * 若共享 schema 变更，请同步修改 `packages/convex/schemas` 与本文件。
 */

const documentTable = defineTable({
  title: v.string(),
  userId: v.string(),
  isArchived: v.boolean(),
  parentDocument: v.optional(v.id("documents")),
  content: v.optional(v.string()),
  coverImage: v.optional(v.string()),
  icon: v.optional(v.string()),
  isPublished: v.boolean(),
  isStarred: v.optional(v.boolean()),
  isInKnowledgeBase: v.optional(v.boolean()),
  lastEditedTime: v.optional(v.number()),
})
  .index("by_user", ["userId"])
  .index("by_user_parent", ["userId", "parentDocument"]);

const aiConversationsTable = defineTable({
  userId: v.string(),
  title: v.string(),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_user", ["userId"]);

const aiMessagesTable = defineTable({
  conversationId: v.id("aiConversations"),
  content: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  createdAt: v.number(),
  documentId: v.optional(v.id("documents")),
}).index("by_conversation", ["conversationId"]);

const aiThinkingStepsTable = defineTable({
  conversationId: v.id("aiConversations"),
  messageId: v.optional(v.id("aiMessages")),
  type: v.string(),
  content: v.string(),
  details: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_conversation", ["conversationId"])
  .index("by_message", ["messageId"]);

export default defineSchema({
  documents: documentTable,
  aiConversations: aiConversationsTable,
  aiMessages: aiMessagesTable,
  aiThinkingSteps: aiThinkingStepsTable,
});
