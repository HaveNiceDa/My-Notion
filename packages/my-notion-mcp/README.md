# @mynotion/mcp

独立发布的 My-Notion MCP STDIO server。它面向支持 MCP 的 Agent / Client 暴露 My-Notion 文档工具，底层复用仓库内部 `@mynotion/agent-tools` 工具契约；`agent-tools` 会随本包打包，不单独发布。

## Install

```bash
npm install -g @mynotion/mcp@latest
```

需要先用 CLI 完成授权：

```bash
npm install -g @mynotion/cli@latest
my-notion auth login
```

## Start

```bash
my-notion-mcp --transport stdio
```

MCP Client 配置示例：

```json
{
  "mcpServers": {
    "my-notion": {
      "command": "my-notion-mcp",
      "args": ["--transport", "stdio"]
    }
  }
}
```

兼容入口仍保留：

```bash
my-notion mcp serve --transport stdio
```

## Tools

- `my_notion_readme`
- `my_notion_docs_search`
- `my_notion_docs_fetch`
- `my_notion_docs_create`
- `my_notion_docs_update`

写工具默认 `dryRun: true`。只有用户明确批准后，Agent 才能设置 `dryRun: false` 执行真实写入。

## Content Contract

- Agent / CLI / MCP 默认只读写 Markdown。
- My-Notion 内部存储 BlockNote JSON。
- 使用 `contentMarkdown` / `structuredContent.markdown` 作为 Agent 可编辑视图。
