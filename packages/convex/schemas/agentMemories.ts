import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Agent 基础记忆表：只保留文档/画板业务需要的三类记忆。 */
export const agentMemoriesTable = defineTable({
  /** 用户ID，当前项目内与 Clerk userId / identity.subject 保持一致 */
  userId: v.string(),
  /** 记忆类型：用户偏好、项目规则、最近决策 */
  type: v.union(v.literal("preference"), v.literal("project"), v.literal("episodic")),
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
  /** 来源原文片段，用于用户确认时理解为什么要记住 */
  evidenceText: v.optional(v.string()),
  /** 置信度 0-1，MVP 默认 1 */
  confidence: v.number(),
  /** active 可被读取；pending_review/rejected 为 M25 Inbox 预留 */
  status: v.union(
    v.literal("pending_review"),
    v.literal("active"),
    v.literal("rejected"),
    v.literal("deleted"),
  ),
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_user_and_status", ["userId", "status"])
  .index("by_user_type_and_status", ["userId", "type", "status"])
  .index("by_user_and_updatedAt", ["userId", "updatedAt"]);
