# Agent Stream Resume Protocol

## 背景

当前 Web Agent 已支持“尚未收到任何流式事件前”的安全重试，但一旦前端已经展示文本、推理或 tool 状态，中断后不能自动重试，否则会导致重复 token、重复 tool 调用或重复写入预览。

本协议定义完整流式续跑的 checkpoint/resume 契约。当前已落地 Phase 1/2/3：run 控制事件、事件与 checkpoint 持久化、backlog replay，以及失败 run 的保守 checkpoint 恢复。

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

当前实现由 `/api/agent/stream` 在初始请求时生成 `run_${crypto.randomUUID()}`，并通过 Convex `agentRuns` 记录 run 归属、模型、模式和 `lastSeq`。

### Event Sequence

每个服务端输出事件都带单调递增的 `seq`。当前实现通过 `AgentRunRecorder` 统一分配 `seq`，并把写入前端的同一份事件异步持久化到 `agentRunEvents`。

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

`resumeState` 是服务端恢复所需的最小状态，不存储不可控大对象。当前文档上下文只保存 `id/title/contentHash` 摘要，不把文档全文写入 checkpoint。

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

- 如果 `runId` 仍在执行，返回 `seq > lastAppliedSeq` 的 backlog；同一条 live stream 接管后续进入 Phase 4/Trace Replay 阶段完善。
- 如果 `runId` 已完成，返回剩余 backlog 和 `finish`。
- 如果 `runId` 已失败且存在可恢复 checkpoint，从最近 checkpoint 保守恢复 ReAct Loop，并复用已完成 tool result。
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

当前落地采用兼容式事件扩展：控制事件直接包含 `runId/seq`，由 recorder 写出的普通 `text/tool/finish/error` 事件也会附带 `runId/seq`，前端据此推进 `AgentStreamResumeCursor`。

## Tool 恢复规则

### 只读工具

只读工具可根据 `toolName + normalized arguments` 复用结果。

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

当前 Phase 3 实现会从 checkpoint 中恢复 `toolResults`，按 `getToolSignature(toolName, args)` 注入 `runReActLoop` 的 run-local cache，避免重复执行已经完成的写入预览或只读工具。

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

- 状态：已完成。
- 增加 `run-start`、`checkpoint`、`resume-start`、`resume-unavailable` 类型。
- 前端记录 `runId`、`lastAppliedSeq` 和 `assistantMessageId`，并写入 `sessionStorage`。
- `stream-client` 支持从已有 resume cursor 初始化，恢复时继续推进 checkpoint cursor。

### Phase 2：事件持久化

- 状态：已完成。
- 新增 `agentRuns` / `agentRunEvents` / `agentRunCheckpoints`。
- 每个 recorder 输出的流式事件写入 event log，checkpoint 写入 checkpoint log。
- resume 请求通过 `getAgentRunBacklog` 重放 `seq > lastAppliedSeq` 的 backlog。

### Phase 3：真正续跑

- 状态：已完成保守版本。
- failed run 可读取最近 checkpoint 并恢复 ReAct Loop。
- 已完成 tool results 会注入 run-local cache，避免重复执行已经完成的 tool call。
- 写入类工具仍只恢复 dry-run/预览结果，不跳过用户确认链路。
- 恢复时会基于 checkpoint 中的 `currentDocument.id` 重新查询当前文档，恢复 `document_read/document_update` 等依赖当前文档的工具上下文。
- 前端已提供“继续生成”入口，读取 `sessionStorage` 中最近 cursor 并发起 resume 请求。
- 如果原 run 仍为 `running`，resume 响应会在受控窗口内长轮询新增 `agentRunEvents` 并持续续传；窗口到期仍未完成时返回可恢复错误，前端保留 cursor。
- resume 完成后会更新同一条已落库 assistant 消息，避免历史记录停留在中断内容。

### Phase 4：Trace Replay

- 将 `agentRunEvents` 与 trace sink 关联。
- 提供 replay UI，按 seq 重放 text/tool/checkpoint。
- 将 running run 长轮询接管升级为更实时的订阅/推送机制，并补齐 Trace Replay 可视化。
