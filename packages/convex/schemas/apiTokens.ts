import { defineTable } from "convex/server";
import { v } from "convex/values";

/** My-Notion CLI / Agent 使用的个人访问令牌，仅存储哈希值。 */
export const apiTokensTable = defineTable({
  /** 关联 Clerk 用户 ID。 */
  userId: v.string(),
  /** 用户可识别的 token 名称。 */
  name: v.string(),
  /** 明文 token 的 SHA-256 哈希，禁止存储明文。 */
  tokenHash: v.string(),
  /** token 前缀，用于状态展示和审计，不具备认证能力。 */
  tokenPrefix: v.string(),
  /** 权限范围，例如 docs:read、docs:write。 */
  scopes: v.array(v.string()),
  /** 创建时间戳。 */
  createdAt: v.number(),
  /** 最近使用时间戳。 */
  lastUsedAt: v.optional(v.number()),
  /** 过期时间戳；未设置则不过期。 */
  expiresAt: v.optional(v.number()),
  /** 撤销时间戳；设置后 token 不再可用。 */
  revokedAt: v.optional(v.number()),
})
  .index("by_token_hash", ["tokenHash"])
  .index("by_user", ["userId"]);
