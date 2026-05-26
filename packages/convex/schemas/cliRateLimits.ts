import { defineTable } from "convex/server";
import { v } from "convex/values";

/** My-Notion CLI / Agent 机器 API 简单窗口限流计数。 */
export const cliRateLimitsTable = defineTable({
  /** PAT 记录 ID，限流不使用 PAT 明文或 token hash。 */
  tokenId: v.id("apiTokens"),
  /** 归一化 endpoint，例如 GET /cli/v1/documents/:id。 */
  endpointKey: v.string(),
  /** 当前窗口 key，例如 2026-05-26T09:45。 */
  windowKey: v.string(),
  /** 当前窗口内已消耗请求数。 */
  count: v.number(),
  /** 窗口开始时间戳。 */
  windowStart: v.number(),
  /** 窗口结束时间戳。 */
  expiresAt: v.number(),
  /** 记录更新时间戳。 */
  updatedAt: v.number(),
})
  .index("by_token_endpoint_window", ["tokenId", "endpointKey", "windowKey"])
  .index("by_expires_at", ["expiresAt"]);
