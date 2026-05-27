# M11: Agent Stream + Knowledge Search Tool

## 目标

将 AI Chat 后端从旧 `/api/rag-stream` 主路径切换到统一 Agent stream 入口，并把 RAG 检索抽离为 `knowledge_search` tool。

## 关键改动

- 新增 `/api/agent/stream`，输出 Agent NDJSON 流式事件。
- 定义 `text-delta`、`reasoning-delta`、`tool-call-*`、`finish`、`error` 事件，替代旧 RAG SSE 事件。
- 实现 `knowledge_search` tool，复用 Qdrant 向量检索能力返回相关文档片段。
- RAG 模式先执行 tool，再由模型基于 tool 结果生成最终回答。
- 前端 `useAIChat` 已切换到 Agent API，并将 tool 调用状态透传到消息列表。
- UI 只展示通用 tool 状态，不恢复旧 StepItem 或硬编码 thinking process。

## 验证

- `pnpm --filter @notion/web exec tsc --noEmit`: ✅
- `pnpm --filter @notion/web lint`: ✅ 通过，有 4 个既有 warning
- `pnpm --filter @notion/web build`: ✅

## 关联 progress 文件

- 旧过程日志已清理，阶段结论以本 milestone 为准。

## 后续待办

- 接入 `document_read` tool，打通当前文档快捷动作。
- 将知识库初始化/同步逻辑沉淀到 Agent tool 内部。
- Agent 主路径稳定后清理旧 `/api/rag-stream`、`/api/rag-complete`。
- 扩展 tool 调用历史回放和结果详情展示。
