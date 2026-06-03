import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Agent 长期记忆表：结构化源记录是 Memory 的可信来源，向量索引后续只做召回加速。 */
export const agentMemoriesTable = defineTable({
  /** 用户ID，当前项目内与 Clerk userId / identity.subject 保持一致 */
  userId: v.string(),
  /** 记忆类型：用户偏好、项目事实、阶段性对话结论 */
  type: v.union(v.literal("preference"), v.literal("project"), v.literal("episodic")),
  /** M23 新模型分层：instruction/semantic/episodic/procedural；旧数据缺失时由 logic 层派生 */
  kind: v.optional(v.union(
    v.literal("instruction"),
    v.literal("semantic"),
    v.literal("episodic"),
    v.literal("procedural"),
  )),
  /** 细分类别，例如 user_preference/project_fact/session_note */
  category: v.optional(v.string()),
  /** 作用域层级，M23 默认 user，后续用于 project/document/conversation/module/path 隔离 */
  scopeLevel: v.optional(v.union(
    v.literal("user"),
    v.literal("workspace"),
    v.literal("project"),
    v.literal("document"),
    v.literal("conversation"),
    v.literal("module"),
    v.literal("path"),
  )),
  /** 作用域键，M23 默认 userId */
  scopeKey: v.optional(v.string()),
  /** 记忆正文，保持可解释、可审查 */
  content: v.string(),
  /** 来源：user_explicit 表示用户明确要求记住；agent_proposed 表示 Agent 提议后确认 */
  source: v.union(
    v.literal("user_explicit"),
    v.literal("agent_proposed"),
    v.literal("manual"),
    v.literal("auto_extracted"),
    v.literal("system"),
  ),
  /** 写入原因，方便后续 Memory Review UI 展示来源 */
  reason: v.optional(v.string()),
  /** Prompt 注入使用的短摘要，M23 先落字段，M24 起参与 compact instruction memory */
  summary: v.optional(v.string()),
  /** 轻量标签，避免 M23 引入独立 relation 表 */
  tags: v.optional(v.array(v.string())),
  /** 来源证据：对话、消息、文档、tool call 或原文片段 */
  evidenceConversationId: v.optional(v.id("aiConversations")),
  evidenceMessageId: v.optional(v.id("aiMessages")),
  evidenceDocumentId: v.optional(v.id("documents")),
  evidenceToolCallId: v.optional(v.string()),
  evidenceText: v.optional(v.string()),
  evidenceUrl: v.optional(v.string()),
  /** 置信度 0-1，MVP 默认 1 */
  confidence: v.number(),
  /** 重要性 0-1，用于后续召回排序和复查优先级 */
  importance: v.optional(v.number()),
  /** 记忆稳定性：stable 适合常驻，temporary 适合过期治理 */
  stability: v.optional(v.union(
    v.literal("stable"),
    v.literal("evolving"),
    v.literal("temporary"),
  )),
  /** 敏感级别，后续用于限制自动注入和索引 */
  privacy: v.optional(v.union(v.literal("normal"), v.literal("sensitive"))),
  /** active 可被读取；pending_review/rejected 为 M25 Inbox 预留 */
  status: v.union(
    v.literal("draft"),
    v.literal("pending_review"),
    v.literal("active"),
    v.literal("superseded"),
    v.literal("archived"),
    v.literal("rejected"),
    v.literal("deleted"),
  ),
  /** 被哪条新记忆取代 */
  supersededBy: v.optional(v.id("agentMemories")),
  /** 当前记忆取代的旧记忆列表 */
  supersedes: v.optional(v.array(v.id("agentMemories"))),
  /** 与当前记忆冲突的记忆列表 */
  conflictsWith: v.optional(v.array(v.id("agentMemories"))),
  /** 可选过期时间，适合 episodic memory */
  expiresAt: v.optional(v.number()),
  /** 建议复查时间，避免长期记忆过期污染上下文 */
  reviewDueAt: v.optional(v.number()),
  /** 最近被 Agent 使用的时间，M24 起更新 */
  lastUsedAt: v.optional(v.number()),
  /** 被 Agent 使用次数，M24 起更新 */
  usageCount: v.optional(v.number()),
  /** 后续接 Qdrant/embedding 时使用 */
  embeddingRef: v.optional(v.string()),
  /** 向量索引同步状态，M23 起落库，M24/M25 后用于移除读路径 upsert */
  embeddingStatus: v.optional(v.union(
    v.literal("pending"),
    v.literal("synced"),
    v.literal("failed"),
    v.literal("skipped"),
  )),
  embeddingUpdatedAt: v.optional(v.number()),
  embeddingError: v.optional(v.string()),
  embeddingRetryCount: v.optional(v.number()),
  nextEmbeddingRetryAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_and_status", ["userId", "status"])
  .index("by_user_type_and_status", ["userId", "type", "status"])
  .index("by_user_and_updatedAt", ["userId", "updatedAt"])
  .index("by_user_and_kind_and_status", ["userId", "kind", "status"])
  .index("by_user_and_scopeLevel_and_scopeKey_and_status", [
    "userId",
    "scopeLevel",
    "scopeKey",
    "status",
  ])
  .index("by_user_and_embeddingStatus", ["userId", "embeddingStatus"])
  .index("by_user_and_reviewDueAt", ["userId", "reviewDueAt"]);
