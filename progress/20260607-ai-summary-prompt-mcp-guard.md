# 2026-06-07 AI Summary Prompt MCP Guard

## 目标

- 收敛“总结下我的文档信息”快捷 prompt，避免一次性触发过多工具。
- 修复模型把 `agentMemories` ID 误传给 `my_notion_docs_fetch.id` 后出现 Convex 参数校验错误的问题。

## 改动

- `summarizeMyDocumentsPrompt` 改为轻量文档汇总指令：最多搜索 8 篇、按需读取最多 3 篇。
- prompt 明确限制只基于 My-Notion 文档，不搜索长期记忆、不写入记忆、不把 `memoryId` / `proposalId` 当作 `documentId`。
- `mcp_my_notion_call` 工具描述补充约束：`my_notion_docs_fetch.id` 必须来自 `my_notion_docs_search` 返回的文档 ID。
- `executeDocsFetch` 捕获 Convex `v.id("documents")` 参数校验错误，返回可恢复 tool error，避免把底层 Server Error 原样展示给用户。
- 增加单测覆盖 `agentMemories` ID 误入 `my_notion_docs_fetch` 的降级行为。

## 验证

- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm --filter @notion/web test -- tools.test.ts ai-chat-components.test.ts`：通过，实际运行 11 个相关/邻近测试文件，共 130 个测试。

## 风险

- prompt 只能降低模型误用概率，不能绝对禁止模型调用多个工具；硬防护仍依赖 MCP adapter 的可恢复错误。
- 如果文档数量很多，当前快捷入口仍是抽样式汇总，不等价于全量离线报告。
