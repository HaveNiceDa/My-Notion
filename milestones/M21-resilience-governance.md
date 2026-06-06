# M21: 韧性与治理

## 状态总览

- 状态：已完成主要闭环。
- 更新时间：2026-06-06。
- 本阶段交付目标：补齐 Web Agent 的流式重试、Tool 结果契约统一、强类型 sources、Plan 状态增强，以及流式续跑 Phase 1/2/3。
- 本阶段非目标：Trace Replay UI、Storybook、Memory/RAG 真实质量评估、running run 的 live stream 接管。

## 目标

在 M20 MCP adapter 可用后，提高 Web Agent 执行链路的韧性与可治理性，降低网络抖动、Tool 结果不一致和 Plan 刷新丢状态带来的体验风险。

## 已完成

### 流式重试

- `runAgentStream` 默认支持 1 次安全重试。
- fetch 失败或尚未收到任何 NDJSON 事件时可重试。
- 已收到文本、推理或 tool 事件后发生中断时不重试，避免重复输出和重复 tool 状态。
- 408/5xx 作为可重试 HTTP 状态；429 继续使用 `Retry-After` 友好错误。
- 完整 checkpoint/resume 协议已形成设计文档，Phase 1/2/3 已落地：`docs/agent-stream-resume-protocol.md`。

### 流式续跑 Phase 1/2/3

- Phase 1：新增 `run-start`、`checkpoint`、`resume-start`、`resume-unavailable` 控制事件，前端记录 `AgentStreamResumeCursor`。
- Phase 2：新增 `agentRuns`、`agentRunEvents`、`agentRunCheckpoints` Convex 表和函数，`AgentRunRecorder` 统一分配 `seq` 并持久化 event/checkpoint。
- Phase 2：resume 请求支持 `getAgentRunBacklog`，按 `seq > lastAppliedSeq` replay 已保存 backlog，已完成 run 会补发 `finish`。
- Phase 3：失败 run 可从最近 checkpoint 保守恢复 ReAct Loop，并通过 `resumeToolResults` 复用已完成 tool result，避免重复执行写入预览工具。
- Phase 3：前端已提供“继续生成”入口，并在恢复时基于 checkpoint 的 `currentDocument.id` 重建完整当前文档上下文。
- running run 支持受控长轮询接管，resume 窗口内可持续续传新增 event；窗口到期仍保留 cursor。
- resume 完成后支持原地更新已落库 assistant 消息，避免历史消息停留在中断内容。

### Tool 结果契约

- 新增 `tool-result-v1` 契约基建。
- fallback 错误、文档写入预览、task_plan、MCP adapter metadata 开始携带 `contractVersion`。
- 主要 Web Agent tools 已统一携带 `summary`、`sources`、`metadata`、`recoverable`。
- `sources` 已收敛为 `document/web/memory` discriminated union，为 Trace Replay 和 UI 展示提供稳定类型。
- 业务字段保持兼容：`documents`、`results`、`document`、`memory`、`markdown` 等不迁移不改名。
- 保持现有业务 result shape 兼容，避免破坏 Tool 卡片和已保存历史消息。

### Plan 状态增强

- `task_plan` 确认执行后写回 `aiMessages.toolResults`。
- `ToolCallCard` 可读取 `planExecutionStatus: "started"` 并恢复已开始执行状态。
- Convex `updateToolResultState` 支持 task_plan 状态写回。

## 关键决策

- 流式重试只在无可见输出时自动执行，优先避免重复 token 和重复 tool 调用。
- Tool 结果契约采用 envelope 补充方式，先保证运行时和历史消息兼容；`sources` 使用强类型 union 承载主来源。
- Plan 状态先持久化“已开始执行”这一用户可感知状态，步骤级事件流后置。

## 验证

- `pnpm --filter @notion/web test -- src/components/ai-chat/stream-client.test.ts src/components/ai-chat/ai-chat-components.test.ts src/lib/agent/__tests__/tools.test.ts`：✅
- `pnpm --filter @notion/web typecheck`：✅
- `pnpm --filter @notion/web lint`：✅，仅有既有 warning，无 error。
- `pnpm --filter @notion/web build`：✅
- `pnpm --filter @notion/web test -- src/lib/agent/__tests__/tools.test.ts src/lib/agent/__tests__/document-read.test.ts`：✅，Tool 契约全量统一补充验证。
- `pnpm --filter @notion/web test -- src/lib/agent/__tests__/tools.test.ts src/lib/agent/__tests__/document-read.test.ts src/lib/agent/__tests__/stream.test.ts src/components/ai-chat/stream-client.test.ts`：✅，强类型 sources 与流式协议类型补充验证。
- `pnpm --filter @notion/web test -- src/components/ai-chat/stream-client.test.ts src/lib/agent/__tests__/react-loop.test.ts`：✅，覆盖 resume cursor、resume-unavailable 和 checkpoint tool result 复用；命令实际跑完 Web 全部 Vitest 用例。
- `pnpm --filter @notion/web test -- src/components/ai-chat/stream-client.test.ts src/components/ai-chat/ai-chat-components.test.ts src/lib/agent/__tests__/react-loop.test.ts`：✅，覆盖无 finish 不误完成、running 接管窗口错误和继续生成入口；命令实际跑完 Web 全部 Vitest 用例。

## 已知缺口

- running run 当前采用服务端长轮询窗口接管，尚未升级为真正实时订阅/推送。
- Plan 仍未支持步骤级执行事件、逐 step 持久化和跨刷新完整恢复。
- Trace Replay、Storybook、Memory/RAG 真实评估继续留给 M22。

## 关联文档

- `docs/ai-chat-refactor-plan.md`
- `milestones/M20-web-agent-mcp-adapter.md`
- `progress/20260605-234802.md`
- `progress/20260606-091356.md`
- `progress/20260606-095037.md`
- `progress/20260606-100642.md`
- `progress/20260606-113248.md`
- `progress/20260606-120002.md`
- `docs/agent-stream-resume-protocol.md`
- `apps/web/src/components/ai-chat/stream-client.ts`
- `apps/web/src/lib/agent/tools/result-contract.ts`
- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
- `packages/convex/chat/logic/updateToolResult.ts`
