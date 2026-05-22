# M13: Document Read Tool

## 目标

将当前文档读取能力接入 Agent 体系，让 AI Chat 侧边栏能基于当前页面内容执行总结、翻译、深度剖析等快捷动作。

## 关键改动

- 新增客户端当前文档上下文 store。
- 文档详情页负责同步当前文档 ID、标题和内容。
- AI Chat 请求携带当前文档上下文到 `/api/agent/stream`。
- Agent route 新增 `document_read` tool，并在 `auto` 模式下根据用户意图触发。
- `document_read` 将 BlockNote JSON 内容转成纯文本后作为 tool result 提供给模型。
- Tool 状态 UI 增加“读取当前文档”展示。

## 验证

- `pnpm --filter @notion/web exec tsc --noEmit`: ✅
- `pnpm --filter @notion/web lint`: ✅ 通过，有 4 个既有 warning
- `pnpm --filter @notion/web build`: ✅

## 关联 progress 文件

- `progress/20260522-224646.md`

## 后续待办

- 手动验证当前页面快捷动作。
- 将客户端传入文档内容升级为服务端 Convex auth 读取能力。
- 推进通用 tool planner，并清理旧 RAG API。
