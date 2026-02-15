import { defineSchema,defineTable } from "convex/server";
import {v} from 'convex/values'

export default defineSchema({
  documents:defineTable({
    /** 文档标题 */
    title:v.string(),
    /** 用户ID，关联到Clerk用户 */
    userId:v.string(),
    /** 是否归档 */
    isArchived:v.boolean(),
    /** 父文档ID，用于构建文档层级结构 */
    parentDocument:v.optional(v.id('documents')),
    /** 文档内容，使用BlockNote格式 */
    content:v.optional(v.string()),
    /** 封面图片URL */
    coverImage:v.optional(v.string()),
    /** 文档图标 */
    icon:v.optional(v.string()),
    /** 是否发布 */
    isPublished:v.boolean(),
    /** 是否收藏 */
    isStarred:v.optional(v.boolean()),
    /** 最后编辑时间戳 */
    lastEditedTime:v.optional(v.number())
  })
  .index('by_user',['userId'])
  .index('by_user_parent',['userId','parentDocument']),
  
  ragConversations: defineTable({
    /** 用户ID */
    userId: v.string(),
    /** 对话标题 */
    title: v.string(),
    /** 创建时间 */
    createdAt: v.number(),
    /** 更新时间 */
    updatedAt: v.number(),
  })
  .index('by_user', ['userId']),
  
  ragMessages: defineTable({
    /** 对话ID */
    conversationId: v.id('ragConversations'),
    /** 消息内容 */
    content: v.string(),
    /** 角色：user 或 assistant */
    role: v.union(v.literal('user'), v.literal('assistant')),
    /** 创建时间 */
    createdAt: v.number(),
    /** 关联的文档ID（可选） */
    documentId: v.optional(v.id('documents')),
  })
  .index('by_conversation', ['conversationId']),
})