import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Agent 长期记忆表：结构化源记录是 Memory 的可信来源，向量索引后续只做召回加速。 */
export const agentMemoriesTable = defineTable({
  /** 用户ID，当前项目内与 Clerk userId / identity.subject 保持一致 */
  userId: v.string(),
  /** 记忆类型：用户偏好、项目事实、阶段性对话结论 */
  type: v.union(v.literal("preference"), v.literal("project"), v.literal("episodic")),
  /** 记忆正文，保持可解释、可审查 */
  content: v.string(),
  /** 来源：user_explicit 表示用户明确要求记住；agent_proposed 表示 Agent 提议后确认 */
  source: v.union(v.literal("user_explicit"), v.literal("agent_proposed"), v.literal("manual")),
  /** 写入原因，方便后续 Memory Review UI 展示来源 */
  reason: v.optional(v.string()),
  /** 置信度 0-1，MVP 默认 1 */
  confidence: v.number(),
  /** active 可被读取；superseded 保留历史；deleted 为软删除 */
  status: v.union(v.literal("active"), v.literal("superseded"), v.literal("deleted")),
  /** 被哪条新记忆取代 */
  supersededBy: v.optional(v.id("agentMemories")),
  /** 可选过期时间，适合 episodic memory */
  expiresAt: v.optional(v.number()),
  /** 后续接 Qdrant/embedding 时使用 */
  embeddingRef: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_and_status", ["userId", "status"])
  .index("by_user_type_and_status", ["userId", "type", "status"])
  .index("by_user_and_updatedAt", ["userId", "updatedAt"]);
