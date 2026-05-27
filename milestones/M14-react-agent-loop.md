# M14: ReAct Agent Loop 重构

## 目标

将当前硬编码关键词匹配的 tool 路由，重构为标准 ReAct（Reasoning + Acting）循环，让 LLM 自主决定是否调用工具、调用哪个工具、以及是否需要多轮工具调用。

## 关键改动

### 新增文件

| 文件 | 内容 |
|---|---|
| `lib/agent/tools/definitions.ts` | `AgentTool` 接口 + `knowledgeSearchTool` / `documentReadTool` / `webSearchTool` 定义 |
| `lib/agent/tools/registry.ts` | `buildAvailableTools()` — 根据上下文构建可用 tool 列表 |
| `lib/agent/tools/web-search.ts` | `executeWebSearch` — 通过 DashScope `enable_search` 联网搜索 |
| `lib/agent/stream.ts` | `AgentStreamEvent` 类型 + `enqueueEvent` + `streamModelResponse` + `createThinkingBody` |
| `lib/agent/react-loop.ts` | `runReActLoop` — ReAct 循环引擎（MAX_ITERATIONS=5） |

### 删除的代码

| 文件 | 删除内容 |
|---|---|
| `knowledge-search.ts` | `KNOWLEDGE_SEARCH_SIGNALS`、`shouldUseKnowledgeSearch()`、`createKnowledgeSearchToolCall()` |
| `document-read.ts` | `DOCUMENT_READ_SIGNALS`、`shouldReadCurrentDocument()`、`createDocumentReadToolCall()` |
| `types.ts` | `PendingToolCall`、`ToolExecutionResult`（改用 OpenAI 原生 `ChatCompletionMessageFunctionToolCall`） |
| `route.ts` | 所有 `should*` 判断、手动伪造 `tool_calls`、`mode` 参数处理、`extractLastUserText`、内联函数 |
| `useAIChat.ts` | 移除 `mode: "auto"` 请求参数 |

### 删除的旧 API 路由

| 路由 | 说明 |
|---|---|
| `/api/chat` | 旧聊天路由 |
| `/api/rag-stream` | 旧 RAG 流式路由 |
| `/api/rag-complete` | 旧 RAG 完成路由 |
| `/api/embeddings` | 旧 embedding 路由 |
| `/api/qdrant` | 旧 Qdrant 路由 |
| `lib/rag/ragUtils.ts` | 旧 RAG 工具库 |

### 架构变化

- **之前**：后端用关键词列表判断是否调 tool → 伪造 `assistant.tool_calls` → 执行 tool → 将结果拼入 messages → 调 LLM 生成回答
- **之后**：LLM 看到可用 tools 列表 → 自主决定是否调 tool → 执行 tool → 将结果加入 messages → LLM 继续推理（最多 5 轮）

### Agent Tool 全景

| Tool | 触发场景 | 参数 |
|---|---|---|
| `knowledge_search` | 个人笔记/文档/项目资料等私有信息 | `query`, `topK?` |
| `web_search` | 最新新闻/天气/股票等实时信息 | `query`, `strategy?` |
| `document_read` | 总结/翻译/分析当前页面 | 无参数 |

### Bug 修复

- `document_read` tool：移除 LLM 无法知道的 `documentId` 必填参数，改为无参数 tool
- 前端消息构建：修复当前用户消息丢失和历史消息 JSON 格式问题
- `ToolContext` 新增 `model` 字段，web_search 使用用户选择的模型

### DashScope 兼容性

- `tool_choice` 始终 `"auto"`，规避 thinking mode 与 `object`/`required` 的 400 冲突
- 使用 `ChatCompletionMessageFunctionToolCall` 类型（OpenAI SDK v5 联合类型窄化）

## 验证

- `pnpm --filter @notion/web exec tsc --noEmit`: ✅
- `pnpm --filter @notion/web build`: ✅
- `pnpm --filter @notion/web lint`: ✅（4 个既有 warning）
- 功能验证：普通对话 ✅、知识库检索 ✅、文档阅读 ✅、联网搜索 ✅

## 关联 progress 文件

- 旧过程日志已清理，阶段结论以本 milestone 为准。

## 后续待办

- 接入 web_extractor tool（网页抓取）
- 接入 MCP 服务
- Spec 模式 / Plan 模式
