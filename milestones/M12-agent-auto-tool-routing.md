# M12: Agent Auto Tool Routing

## 目标

移除 AI Chat 输入框中的显式 RAG 开关，让前端统一进入 Agent `auto` 模式，由后端决定是否调用知识库检索能力。

## 关键改动

- 前端不再维护 `chat` / `rag` 模式状态。
- 输入框移除 RAG 知识库 icon，只保留深度思考、模型选择和发送入口。
- `/api/agent/stream` 新增 `auto` 模式，默认根据用户 query 信号判断是否执行 `knowledge_search`。
- `knowledge_search` 由后端直接执行，不使用 DashScope object/required `tool_choice`，规避 thinking mode 兼容问题。
- 知识库检索失败时作为 tool result 返回，避免 Agent 响应直接失败。

## 验证

- `pnpm --filter @notion/web exec tsc --noEmit`: ✅
- `pnpm --filter @notion/web lint`: ✅ 通过，有 4 个既有 warning
- `pnpm --filter @notion/web build`: ✅

## 关联 progress 文件

- `progress/20260522-175204.md`

## 后续待办

- 接入 `document_read` tool，让当前文档快捷动作进入 Agent 能力体系。
- 将启发式 `auto` 策略升级为通用 tool planner。
- Agent 主路径稳定后清理旧 RAG API 和旧 thinking step 残留代码。
