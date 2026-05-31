import { defineTable } from "convex/server";
import { v } from "convex/values";

/** My-Notion CLI Device Flow 授权会话。 */
export const cliDeviceAuthSessionsTable = defineTable({
  /** CLI 持有的 device code 哈希，用于轮询和最终换取 token。 */
  deviceCodeHash: v.string(),
  /** 浏览器页面展示/校验的用户码哈希。 */
  userCodeHash: v.string(),
  /** 展示给用户核对的短码，不具备最终换 token 能力。 */
  userCodeDisplay: v.string(),
  /** pending -> approved/denied -> consumed/expired。 */
  status: v.union(
    v.literal("pending"),
    v.literal("approved"),
    v.literal("denied"),
    v.literal("consumed"),
    v.literal("expired"),
  ),
  /** Clerk 用户 ID，只有 approve 后写入。 */
  userId: v.optional(v.string()),
  scopes: v.array(v.string()),
  profile: v.optional(v.string()),
  apiUrl: v.optional(v.string()),
  webUrl: v.optional(v.string()),
  clientName: v.optional(v.string()),
  clientVersion: v.optional(v.string()),
  machineName: v.optional(v.string()),
  createdAt: v.number(),
  expiresAt: v.number(),
  approvedAt: v.optional(v.number()),
  consumedAt: v.optional(v.number()),
  lastPolledAt: v.optional(v.number()),
  pollCount: v.optional(v.number()),
  lastDecisionAttemptAt: v.optional(v.number()),
  decisionAttemptCount: v.optional(v.number()),
})
  .index("by_device_code_hash", ["deviceCodeHash"])
  .index("by_user_code_hash", ["userCodeHash"])
  .index("by_expires_at", ["expiresAt"])
  .index("by_user", ["userId"]);
