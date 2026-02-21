import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  documents: defineTable({
    /** 文档标题 */
    title: v.string(),
    /** 用户ID，关联到Clerk用户 */
    userId: v.string(),
    /** 是否归档 */
    isArchived: v.boolean(),
    /** 父文档ID，用于构建文档层级结构 */
    parentDocument: v.optional(v.id("documents")),
    /** 文档内容，使用BlockNote格式 */
    content: v.optional(v.string()),
    /** 封面图片URL */
    coverImage: v.optional(v.string()),
    /** 文档图标 */
    icon: v.optional(v.string()),
    /** 是否发布 */
    isPublished: v.boolean(),
    /** 是否收藏 */
    isStarred: v.optional(v.boolean()),
    /** 是否在知识库中 */
    isInKnowledgeBase: v.optional(v.boolean()),
    /** 最后编辑时间戳 */
    lastEditedTime: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentDocument"]),

  aiConversations: defineTable({
    /** 用户ID */
    userId: v.string(),
    /** 对话标题 */
    title: v.string(),
    /** 创建时间 */
    createdAt: v.number(),
    /** 更新时间 */
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  aiMessages: defineTable({
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
  }).index("by_conversation", ["conversationId"]),

  /** 文档向量chunks表 - 存储每个文档切分后的向量数据 */
  documentChunks: defineTable({
    /** 用户ID */
    userId: v.string(),
    /** 关联的文档ID */
    documentId: v.id("documents"),
    /** chunk在文档中的索引位置 */
    chunkIndex: v.number(),
    /** 1536维向量数组 */
    embedding: v.array(v.number()),
    /** chunk的原始文本内容 */
    pageContent: v.string(),
    /** 元数据（标题等） */
    metadata: v.object({
      title: v.string(),
      documentId: v.string(),
    }),
    /** chunk内容的哈希值，用于检测变更 */
    contentHash: v.string(),
    /** 创建时间 */
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_document", ["userId", "documentId"])
    .index("by_document", ["documentId"]),

  /** 文档embedding状态表 - 追踪每个文档的embedding状态 */
  documentEmbeddingStatus: defineTable({
    /** 用户ID */
    userId: v.string(),
    /** 关联的文档ID */
    documentId: v.id("documents"),
    /** 最后embedding时间 */
    lastEmbeddedTime: v.number(),
    /** 状态：pending, processing, completed, failed */
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    /** 文档内容的哈希值，用于检测是否需要重新embedding */
    contentHash: v.string(),
    /** 错误信息（如果status为failed） */
    errorMessage: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_document", ["userId", "documentId"])
    .index("by_document", ["documentId"]),

  /** AI思考过程步骤表 - 存储模型的思考过程 */
  aiThinkingSteps: defineTable({
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
    .index("by_message", ["messageId"]),
});
