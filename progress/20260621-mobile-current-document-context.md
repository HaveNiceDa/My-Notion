# Mobile Current Document Context

## 背景

移动端 AI Chat 已接入 `/api/agent/stream`，但文档详情页没有 AI 入口，且发送 Agent Stream 时 `currentDocument` 固定为 `null`。这导致移动端无法稳定复用 Web Agent 的“读取当前文档”工具链路。

## 本次收口

- `ChatModal` 支持接收 `currentDocument`，并透传给 `useAgentChatSession`。
- `useAgentChatSession` 在 Mobile Agent Stream 请求中发送当前文档上下文。
- 文档详情页新增 AI 入口，打开 Chat 时传入当前文档 `id/title/content`。
- 当前文档内容优先取编辑器最新 HTML 序列化结果，避免依赖防抖保存完成后才能被 Agent 读取。
- 移动端新增 `typecheck` 脚本，并将 `lint` 覆盖范围扩展为 `app src`。
- 清理扩大 lint 覆盖后暴露的既有 warning，保持移动端 lint 输出干净。

## 验证

```bash
pnpm --filter @notion/mobile typecheck
pnpm --filter @notion/mobile lint
```

以上验证均通过。

## 后续

- 真机验证文档页 AI Chat 读取当前文档、应用切后台续跑、断网恢复。
- 继续补正文图片上传真机验证和移动编辑器复杂 block 降级策略。
