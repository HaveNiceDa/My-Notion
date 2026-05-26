import { defineTable } from "convex/server";
import { v } from "convex/values";

/** My-Notion CLI / Agent 机器 API 审计日志，不记录 PAT 明文或 token hash。 */
export const cliAuditLogsTable = defineTable({
  /** 单次 HTTP 请求的稳定追踪 ID。 */
  requestId: v.string(),
  /** HTTP 方法。 */
  method: v.string(),
  /** 请求路径，不包含 query，避免记录用户搜索词等自由文本。 */
  path: v.string(),
  /** HTTP 响应状态码。 */
  status: v.number(),
  /** 结构化错误码；成功请求不设置。 */
  errorCode: v.optional(v.string()),
  /** 该 endpoint 需要的 scope；无需 scope 的 endpoint 不设置。 */
  requiredScope: v.optional(v.string()),
  /** 认证通过或可解析 token 时关联的 PAT 记录。 */
  tokenId: v.optional(v.id("apiTokens")),
  /** token 前缀，仅用于排查和展示，不具备认证能力。 */
  tokenPrefix: v.optional(v.string()),
  /** PAT 解析出的用户 ID。 */
  userId: v.optional(v.string()),
  /** 本次请求耗时。 */
  durationMs: v.number(),
  /** 写入审计日志的时间戳。 */
  createdAt: v.number(),
})
  .index("by_request_id", ["requestId"])
  .index("by_token", ["tokenId", "createdAt"])
  .index("by_user", ["userId", "createdAt"])
  .index("by_created_at", ["createdAt"]);
