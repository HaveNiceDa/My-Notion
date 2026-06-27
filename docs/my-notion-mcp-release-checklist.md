# My-Notion MCP Server Release Checklist

本清单用于发布独立 `@mynotion/mcp` 前确认 MCP STDIO server 可被 Agent 安全使用。

## 发布对象

- npm package: `@mynotion/mcp`
- binary: `my-notion-mcp`
- internal build-time dependency: `@mynotion/agent-tools`，只作为仓库内部共享代码，不单独发布 npm 包；MCP server 构建时通过 esbuild 打进 `dist`
- compatibility entry: `my-notion mcp serve --transport stdio`

## 必跑验证

```bash
pnpm --filter @mynotion/agent-tools typecheck
pnpm --filter @mynotion/agent-tools test
pnpm --filter @mynotion/agent-tools build

pnpm --filter @mynotion/mcp typecheck
pnpm --filter @mynotion/mcp test
pnpm --filter @mynotion/mcp build
pnpm --filter @mynotion/mcp pack:dry-run

pnpm e2e:mcp
pnpm e2e:mcp:client
```

## 工具发现

`tools/list` 必须包含：

- `my_notion_readme`
- `my_notion_docs_search`
- `my_notion_docs_fetch`
- `my_notion_docs_create`
- `my_notion_docs_update`

## 安全边界

- 第一版只支持 STDIO transport。
- MCP server 不接收完整 PAT 作为 tool 参数。
- 写工具默认 `dryRun: true`。
- dry-run 必须包含 `confirmationRequired: true` 和明确 no-write 文案。
- 真实写入只允许用户明确批准后使用 `dryRun: false`。
- 文档内容对 Agent 统一使用 Markdown / `contentMarkdown`。

## 发布顺序

1. 确认 `@mynotion/agent-tools` 为 `private: true`，且 `@mynotion/mcp/dist` 中没有裸的 `@mynotion/agent-tools` runtime import。
2. 发布 `@mynotion/mcp`。
3. 如 CLI 依赖版本发生变化，再发布 `@mynotion/cli`。
4. 更新并同步 Skills。
