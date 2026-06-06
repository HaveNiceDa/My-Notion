import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Agent 运行主表：用于流式续跑、事件回放和 Trace Replay。 */
export const agentRunsTable = defineTable({
  runId: v.string(),
  userId: v.string(),
  conversationId: v.id("aiConversations"),
  assistantMessageId: v.string(),
  model: v.string(),
  mode: v.union(v.literal("chat"), v.literal("plan")),
  status: v.union(
    v.literal("running"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("cancelled"),
  ),
  lastSeq: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  expiresAt: v.number(),
}).index("by_run", ["runId"])
  .index("by_user", ["userId"])
  .index("by_conversation", ["conversationId"]);

/** Agent 流式事件日志：按 runId + seq 支持 backlog replay。 */
export const agentRunEventsTable = defineTable({
  runId: v.string(),
  userId: v.string(),
  seq: v.number(),
  eventType: v.string(),
  eventJson: v.string(),
  createdAt: v.number(),
}).index("by_run_seq", ["runId", "seq"])
  .index("by_user", ["userId"]);

/** Agent checkpoint：保存可恢复边界和最小 resumeState。 */
export const agentRunCheckpointsTable = defineTable({
  runId: v.string(),
  userId: v.string(),
  seq: v.number(),
  kind: v.string(),
  checkpointJson: v.string(),
  createdAt: v.number(),
}).index("by_run_seq", ["runId", "seq"])
  .index("by_user", ["userId"]);
