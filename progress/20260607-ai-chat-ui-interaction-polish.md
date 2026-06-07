# 2026-06-07 AI Chat UI Interaction Polish

## 目标

- 避免 AI 回复生成中点击确认型 tool 卡片导致重复写入或时序冲突。
- 改善输入回车后的滚动体验，减少需要手动下滑的情况。
- 将 AI 空白页快捷操作收敛为当前真实支持的能力。

## 改动

- `ToolCallCard` 支持 `isStreaming`，并向 `document_write`、`document_update`、`memory_write`、`task_plan` 的确认按钮传递生成中禁用状态。
- 生成中确认型卡片提示 `回复结束后可操作` / `Available after the response finishes`，避免用户在 tool 结果尚未完全持久化时操作。
- `MessageList` 在用户发送新消息后主动滚动到底部。
- 用户手动上滑离开底部时，右下角显示回到底部按钮；点击后平滑滚动到底部。
- `EmptyHome` 快捷操作更新为真实支持项：当前文档总结、搜索我的文档、起草新文档、记录长期记忆。
- 当前文档总结仅在存在 `currentDocument` 时显示，避免无文档上下文时给出不可执行入口。

## 验证

- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm --filter @notion/web test -- ai-chat-components.test.ts`：通过，实际运行 11 个相关/邻近测试文件，共 129 个测试。
- `pnpm --filter @notion/web lint`：通过，剩余 7 个既有 warning。
- `GetDiagnostics`：通过。

## 风险

- 回到底部按钮依赖滚动容器距离底部阈值，极小窗口下可能更频繁出现；当前阈值为 48px。
- 快捷操作只负责填充 prompt，真实执行仍遵循 Agent tool 选择与写入确认链路。
