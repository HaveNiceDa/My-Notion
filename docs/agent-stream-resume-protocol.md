# Agent Stream Resume Protocol

## 背景

当前 Web Agent 已支持“尚未收到任何流式事件前”的安全重试，但一旦前端已经展示文本、推理或 tool 状态，中断后不能自动重试，否则会导致重复 token、重复 tool 调用或重复写入预览。

本协议定义完整流式续跑的 checkpoint/resume 契约，用于后续实现已输出内容后的恢复。

## 目标

- 支持用户在已收到部分输出后恢复同一次 Agent run。
- 避免重复展示已输出 token。
- 避免重复执行已经完成的 tool call。
- 保持写入类工具的 `Dry-run -> Preview -> User Confirmation -> Commit` 安全链路。
- 为 Trace Replay 和故障复盘提供稳定事件日志。

## 非目标

- 不保证 LLM 逐 token 完全 deterministic。
- 不允许跳过用户确认直接 commit 写入。
- 不恢复任意外部 MCP server 的副作用工具；MCP 写工具仍必须 dry-run。

## 核心概念

### Agent Run

一次 `/api/agent/stream` 请求对应一个 `runId`。

```ts
interface AgentRunIdentity {
  runId: string;
  conversationId: string;
  assistantMessageId: string;
  model: string;
  mode: "chat" | "plan";
}
```

### Event Sequence

每个服务端输出事件都带单调递增的 `seq`。

```ts
interface AgentStreamEnvelope<T> {
  runId: string;
  seq: number;
  event: T;
  createdAt: number;
}
```

客户端只应用 `seq > lastAppliedSeq` 的事件。重复事件直接丢弃。

### Checkpoint

checkpoint 是可恢复边界，不等同于每个 token。建议在以下时机写入：

- `run_started`
- 每 N 个 text/reasoning delta 聚合后
- `tool_call_started`
- `tool_call_arguments_completed`
- `tool_call_result_persisted`
- 每轮 ReAct iteration 结束
- `run_finished`
- `run_failed`

```ts
type AgentCheckpointKind =
  | "run_started"
  | "assistant_delta"
  | "tool_call_started"
  | "tool_call_arguments_completed"
  | "tool_call_result_persisted"
  | "iteration_completed"
  | "run_finished"
  | "run_failed";

interface AgentRunCheckpoint {
  runId: string;
  seq: number;
  kind: AgentCheckpointKind;
  conversationId: string;
  assistantMessageId: string;
  textLength: number;
  reasoningLength: number;
  completedToolCallIds: string[];
  pendingToolCallIds: string[];
  lastIteration: number;
  resumeState: AgentResumeState;
  createdAt: number;
}
```

## Resume State

`resumeState` 是服务端恢复所需的最小状态，不存储不可控大对象。

```ts
interface AgentResumeState {
  compressedMessages: unknown[];
  model: string;
  enableThinking: boolean;
  mode: "chat" | "plan";
  currentDocument?: {
    id: string;
    title?: string;
    contentHash?: string;
  } | null;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    argumentsJson: string;
    result: unknown;
    resultHash: string;
    completedAt: number;
  }>;
  assistantDraft: {
    text: string;
    reasoning?: string;
  };
}
```

## 请求契约

### 初始请求

```json
{
  "messages": [],
  "modelId": "deepseek-v4-pro",
  "conversationId": "conv",
  "enableThinking": true,
  "mode": "chat"
}
```

服务端返回的第一个事件必须是：

```json
{
  "type": "run-start",
  "runId": "run_...",
  "seq": 1,
  "assistantMessageId": "..."
}
```

### 续跑请求

```json
{
  "resume": {
    "runId": "run_...",
    "lastAppliedSeq": 42,
    "assistantMessageId": "..."
  }
}
```

服务端处理规则：

- 如果 `runId` 仍在执行，返回 `seq > lastAppliedSeq` 的 backlog，然后继续接同一条 live stream。
- 如果 `runId` 已完成，返回剩余 backlog 和 `finish`。
- 如果 `runId` 已失败且存在可恢复 checkpoint，从最近 checkpoint 继续生成。
- 如果 checkpoint 不可恢复，返回 `resume-unavailable`，前端展示“重新生成”入口。

## 事件扩展

现有事件保持兼容，新增事件如下：

```ts
type AgentResumeStreamEvent =
  | { type: "run-start"; runId: string; seq: number; assistantMessageId: string }
  | { type: "checkpoint"; runId: string; seq: number; checkpointKind: AgentCheckpointKind }
  | { type: "resume-start"; runId: string; fromSeq: number; replayedCount: number }
  | { type: "resume-unavailable"; runId: string; reason: string; recoverable: boolean };
```

现有事件迁移到 envelope 后示例：

```json
{
  "runId": "run_123",
  "seq": 12,
  "event": { "type": "text-delta", "id": "assistant", "delta": "继续" },
  "createdAt": 1780710000000
}
```

## Tool 恢复规则

### 只读工具

只读工具可根据 `toolCallId + argumentsHash` 复用结果。

优先级：

1. 使用当前 run 已持久化的 tool result。
2. 命中 tool result cache。
3. 重新执行只读 tool。

### 写入预览工具

写入预览工具只允许恢复 dry-run 预览，不允许自动 commit。

适用工具：

- `document_write`
- `document_update`
- `memory_write`
- `mcp_my_notion_call` 中的写类 MCP 工具

恢复规则：

- 已生成预览且 `confirmationRequired=true`：直接重放 tool result。
- 用户已确认并落库：重放 applied 状态，不重新执行 mutation。
- 未完成预览：重新生成 dry-run 预览，但必须保持 `confirmationRequired=true`。

## 存储建议

新增轻量表：

```ts
agentRuns: {
  runId,
  userId,
  conversationId,
  assistantMessageId,
  status: "running" | "completed" | "failed" | "cancelled",
  lastSeq,
  createdAt,
  updatedAt,
  expiresAt
}

agentRunEvents: {
  runId,
  seq,
  eventType,
  eventJson,
  createdAt
}

agentRunCheckpoints: {
  runId,
  seq,
  kind,
  checkpointJson,
  createdAt
}
```

保留策略：

- 默认保留 24 小时。
- 已完成 run 可压缩保留最终 checkpoint 和 tool results。
- 大型 trace/replay 产物后续可迁移到对象存储。

## 前端状态机

```text
idle
  -> streaming
  -> interrupted
  -> resuming
  -> streaming
  -> completed
```

关键行为：

- 前端持续记录 `lastAppliedSeq`。
- 网络中断后展示“继续生成”按钮。
- 自动续跑仅限最近一次 run，且必须匹配同一 `conversationId` 和 `assistantMessageId`。
- resume 返回的重复事件按 `seq` 去重。

## 安全边界

- 续跑必须校验 `runId` 所属用户。
- 续跑不得接受客户端传回的 tool result 作为事实，只能读取服务端持久化记录。
- 写入类 tool 的 confirmed/applied 状态只信任 Convex 中已保存的 tool result state。
- `device_code`、PAT、LLM key 等敏感信息不得进入 eventJson/checkpointJson。

## 分阶段落地

### Phase 1：协议与类型

- 增加 `run-start`、`checkpoint`、`resume-unavailable` 类型。
- 前端记录 `runId` 和 `lastAppliedSeq`。
- 暂不恢复生成，只能检测可恢复性。

### Phase 2：事件持久化

- 新增 `agentRuns` / `agentRunEvents` / `agentRunCheckpoints`。
- 每个流式事件写入 event log。
- 前端中断后可重放已保存 backlog。

### Phase 3：真正续跑

- 从最近 checkpoint 恢复 ReAct Loop。
- 复用已完成 tool results。
- 只对未完成的 LLM 生成继续请求模型。

### Phase 4：Trace Replay

- 将 `agentRunEvents` 与 trace sink 关联。
- 提供 replay UI，按 seq 重放 text/tool/checkpoint。
