# 2026-06-07 AI Tool Interaction Hardening

## 目标

- 修复 `document_write` 不指定内容时持续返回工具错误的问题。
- 修复长期记忆卡片点击 `Save memory` 静默无反应的问题，并澄清 Inbox 操作语义。
- 修复 Plan/task_plan 渲染中重复 key 警告与相关工具 id 复用风险。
- 降低 Convex 持久化超时造成 `unhandledRejection` 日志的概率。

## 改动

- `document_write` 参数 schema 只要求 `title`，`contentMarkdown` 改为可选；空内容会生成空白文档 dry-run 预览。
- `document_write` 结果 metadata 增加 `blankDocument` 标记，便于后续 UI 或 trace 区分空白文档。
- Memory 写入卡片在缺失 `proposalId` 但有 `memory.content` 时，会先补建 pending proposal，再执行保存。
- Memory 写入卡片不再静默 return；内容缺失或 Inbox proposal 缺失会显示明确错误。
- `Keep in Inbox` 文案改为 `Review later` / `稍后处理`，语义是保留在 Memory Inbox 里待之后审核，不立即激活为长期记忆。
- task_plan 后端对模型返回的重复 `step.id` 做去重，前端步骤 key 改为 `step.id + index`。
- 工具卡片列表 key 改为 `toolResult.id + toolResult.name + index`，降低重复 tool id 的 React key 冲突。
- 流式工具 fallback id 加入 iteration，避免多轮 ReAct 都使用 `tool-0`。
- `AgentRunRecorder` 的事件和 checkpoint 持久化 promise 增加 catch，避免 Convex 超时后产生未处理 rejection。

## 验证

- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm --filter @notion/web test -- tools.test.ts stream.test.ts ai-chat-components.test.ts`：通过，实际运行 11 个相关/邻近测试文件，共 127 个测试。

## 风险

- Memory 保存如果 Convex 当前网络仍不可达，会显示失败信息；这是外部服务可用性问题，不再表现为无反应。
- `document_write` 空内容现在会创建空白文档预览；真实写入仍需用户确认。
