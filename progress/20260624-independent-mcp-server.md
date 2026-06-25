# 2026-06-24 Independent MCP Server

## 背景

原 MCP server 直接内置在 `@mynotion/cli` 的 `my-notion mcp serve --transport stdio` 子命令中，工具注册、dry-run 逻辑和 Machine API client 混在 CLI 包内。这样可用，但 MCP 没有独立发布边界。

## 本阶段调整

- 新增内部 `packages/my-notion-agent-tools`，抽出共享 Machine API client、文档工具 dry-run 逻辑、tool manifest 和 `my_notion_readme`，不单独发布 npm 包。
- 新增 `packages/my-notion-mcp-server`，提供独立 npm 包 `@mynotion/mcp-server` 和 bin `my-notion-mcp-server`。
- CLI 保留 `my-notion mcp serve --transport stdio` 兼容入口，但转调独立 MCP server。
- MCP tools 新增 `my_notion_readme`，帮助 Agent 自发现工具、安全规则和 Markdown 契约。

## 后续验证

```bash
pnpm --filter @mynotion/agent-tools test
pnpm --filter @mynotion/mcp-server test
pnpm --filter @mynotion/cli test
pnpm e2e:mcp
pnpm e2e:mcp:client
```
