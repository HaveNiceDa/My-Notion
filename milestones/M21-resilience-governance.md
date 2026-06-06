# M21: 韧性与治理

## 状态总览

- 状态：已完成主要闭环。
- 更新时间：2026-06-06。
- 本阶段交付目标：补齐 Web Agent 的流式重试、Tool 结果契约统一、强类型 sources 和 Plan 状态增强。
- 本阶段非目标：完整流式续跑实现、Trace Replay、Storybook、Memory/RAG 真实质量评估。

## 目标

在 M20 MCP adapter 可用后，提高 Web Agent 执行链路的韧性与可治理性，降低网络抖动、Tool 结果不一致和 Plan 刷新丢状态带来的体验风险。

## 已完成

### 流式重试

- `runAgentStream` 默认支持 1 次安全重试。
- fetch 失败或尚未收到任何 NDJSON 事件时可重试。
- 已收到文本、推理或 tool 事件后发生中断时不重试，避免重复输出和重复 tool 状态。
- 408/5xx 作为可重试 HTTP 状态；429 继续使用 `Retry-After` 友好错误。
- 完整 checkpoint/resume 协议已形成设计文档：`docs/agent-stream-resume-protocol.md`。

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

## 已知缺口

- 不支持已输出内容后的断点续跑。
- 流式续跑当前完成协议设计和类型入口，尚未实现事件持久化与 backlog replay。
- Plan 仍未支持步骤级执行事件、逐 step 持久化和跨刷新完整恢复。
- Trace Replay、Storybook、Memory/RAG 真实评估继续留给 M22。

## 关联文档

- `docs/ai-chat-refactor-plan.md`
- `milestones/M20-web-agent-mcp-adapter.md`
- `progress/20260605-234802.md`
- `progress/20260606-091356.md`
- `progress/20260606-095037.md`
- `docs/agent-stream-resume-protocol.md`
- `apps/web/src/components/ai-chat/stream-client.ts`
- `apps/web/src/lib/agent/tools/result-contract.ts`
- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
- `packages/convex/chat/logic/updateToolResult.ts`
