# AI 参考文档索引

> 开发前先浏览本文件，按需读取对应文档，不必全量加载。

## 基础能力

| 文件 | 主题 | 何时查阅 |
|---|---|---|
| [dashscope-multi-round-conversation.md](./dashscope-multi-round-conversation.md) | 多轮对话 | ReAct 循环中维护 messages 数组、tool call 多轮消息拼接、对话历史管理时 |
| [dashscope-streaming.md](./dashscope-streaming.md) | 流式输出 | 实现流式响应、解析 streaming chunk、处理 SSE/NDJSON 协议时 |
| [dashscope-deep-thinking.md](./dashscope-deep-thinking.md) | 深度思考 | 配置 `enable_thinking`、解析 `reasoning_content`、排查思考模式兼容性问题时 |
| [dashscope-partial-mode.md](./dashscope-partial-mode.md) | 指定前缀续写 | 代码补全、文本续写、编辑器 AI 辅助、截断内容续写时 |
| [dashscope-context-cache.md](./dashscope-context-cache.md) | 上下文缓存 | 长对话 token 优化、ReAct 多轮迭代降低成本、system prompt 缓存时 |

## 工具调用

| 文件 | 主题 | 何时查阅 |
|---|---|---|
| [tool/dashscope-function-calling.md](./tool/dashscope-function-calling.md) | Function Calling | 开发 Agent 工具调用、新增 tool 定义、排查模型兼容性问题时 |
| [tool/dashscope-mcp.md](./tool/dashscope-mcp.md) | MCP (Model Context Protocol) | 接入百炼托管 MCP 服务、评估 Responses API 迁移时 |
| [tool/dashscope-web-search.md](./tool/dashscope-web-search.md) | 联网搜索 | Agent web_search tool 接入、实时信息查询、搜索策略配置时 |
| [tool/dashscope-web-extractor.md](./tool/dashscope-web-extractor.md) | 网页抓取 | Agent 访问 URL 提取内容、网页总结、技术文档解析时 |
| [tool/dashscope-code-interpreter.md](./tool/dashscope-code-interpreter.md) | 代码解释器 | Agent 数学计算、数据分析、复杂逻辑推理时 |
