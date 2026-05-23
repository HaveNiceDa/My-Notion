# M14: ReAct Agent Loop 重构

## 目标

将当前硬编码关键词匹配的 tool 路由，重构为标准 ReAct（Reasoning + Acting）循环，让 LLM 自主决定是否调用工具、调用哪个工具、以及是否需要多轮工具调用。

## 关键改动

### 新增文件

| 文件 | 内容 |
|---|---|
| `lib/agent/tools/definitions.ts` | `AgentTool` 接口 + `knowledgeSearchTool` / `documentReadTool` 定义（含 OpenAI function schema） |
| `lib/agent/tools/registry.ts` | `buildAvailableTools()` — 根据上下文构建可用 tool 列表 |
| `lib/agent/stream.ts` | `AgentStreamEvent` 类型 + `enqueueEvent` + `streamModelResponse` + `createThinkingBody`（从 route.ts 抽出） |
| `lib/agent/react-loop.ts` | `runReActLoop` — ReAct 循环引擎（MAX_ITERATIONS=5） |

### 删除的代码

| 文件 | 删除内容 |
|---|---|
| `knowledge-search.ts` | `KNOWLEDGE_SEARCH_SIGNALS`、`shouldUseKnowledgeSearch()`、`createKnowledgeSearchToolCall()` |
| `document-read.ts` | `DOCUMENT_READ_SIGNALS`、`shouldReadCurrentDocument()`、`createDocumentReadToolCall()` |
| `types.ts` | `PendingToolCall`、`ToolExecutionResult`（改用 OpenAI 原生 `ChatCompletionMessageFunctionToolCall`） |
| `route.ts` | 所有 `should*` 判断、手动伪造 `tool_calls`、`mode` 参数处理、`extractLastUserText`、内联的 `streamModelResponse`/`enqueueEvent`/`createThinkingBody` |
| `useAIChat.ts` | 移除 `mode: "auto"` 请求参数 |

### 架构变化

- **之前**：后端用关键词列表判断是否调 tool → 伪造 `assistant.tool_calls` → 执行 tool → 将结果拼入 messages → 调 LLM 生成回答
- **之后**：LLM 看到可用 tools 列表 → 自主决定是否调 tool → 执行 tool → 将结果加入 messages → LLM 继续推理（最多 5 轮）

### DashScope 兼容性

- `tool_choice` 始终 `"auto"`，规避 thinking mode 与 `object`/`required` 的 400 冲突
- 使用 `ChatCompletionMessageFunctionToolCall` 类型（OpenAI SDK v5 联合类型窄化）

## 验证

- `pnpm --filter @notion/web exec tsc --noEmit`: ✅
- `pnpm --filter @notion/web build`: ✅
- `pnpm --filter @notion/web lint`: ✅（4 个既有 warning，非本次引入）

## 关联 progress 文件

- `progress/20260523-170000.md`

## 后续待办

- 功能验证：普通对话（无 tool）、知识库检索、文档阅读、多轮 tool 调用
- 清理旧 RAG API 路由（`/api/rag-stream`、`/api/rag-complete`、`/api/chat`）
- 接入 web_search tool
- 接入 MCP 服务
