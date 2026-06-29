# @mynotion/mcp

独立发布的 My-Notion MCP STDIO server。它面向支持 MCP 的 Agent / Client 暴露 My-Notion 文档工具，底层复用仓库内部 `@mynotion/agent-tools` 工具契约；`agent-tools` 会随本包打包，不单独发布。

## 能力边界

- **独立 MCP 包**：不再依赖 `my-notion mcp serve` 作为唯一入口，可直接安装 `@mynotion/mcp`。
- **Agent 友好**：提供 `my_notion_readme`，让 MCP client 先读取工具列表、认证方式和安全规则。
- **默认安全写入**：创建和更新文档默认 `dryRun: true`，只有用户明确批准后才执行真实写入。
- **Markdown 契约**：Agent 只处理 Markdown；My-Notion 内部负责转换成 BlockNote JSON。
- **线上优先**：默认读取 CLI 的 `prod` 登录态；本地调试必须显式传入 local/profile 选项。

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

| Tool | 用途 | 默认安全性 |
| --- | --- | --- |
| `my_notion_readme` | 返回工具说明、认证方式、Markdown 契约和当前 server 环境 | 只读 |
| `my_notion_docs_search` | 搜索当前 PAT 用户的 My-Notion 文档 | 只读 |
| `my_notion_docs_fetch` | 按文档 ID 读取文档元信息和 Markdown 正文 | 只读 |
| `my_notion_docs_create` | 使用 Markdown 创建文档 | 默认 dry-run |
| `my_notion_docs_update` | 追加或覆盖文档标题/正文 | 默认 dry-run |

写工具默认 `dryRun: true`。只有用户明确批准后，Agent 才能设置 `dryRun: false` 执行真实写入。

## Content Contract

- Agent / CLI / MCP 默认只读写 Markdown。
- My-Notion 内部存储 BlockNote JSON。
- 使用 `contentMarkdown` / `structuredContent.markdown` 作为 Agent 可编辑视图。

## Development

```bash
pnpm --filter @mynotion/agent-tools build
pnpm --filter @mynotion/mcp typecheck
pnpm --filter @mynotion/mcp test
pnpm --filter @mynotion/mcp build
pnpm e2e:mcp
pnpm e2e:mcp:client
```

发布前参考仓库根目录的 [MCP Release Checklist](../../docs/my-notion-mcp-release-checklist.md)。
