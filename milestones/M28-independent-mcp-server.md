# M28: Independent MCP Server

## 状态总览

- 状态：实施中。
- 更新时间：2026-06-24。
- 本阶段目标：把 MCP 从 CLI 内部子命令拆成独立发布产物，并抽出 CLI/MCP 共享工具核心。

## 目标

- 新增内部 `@mynotion/agent-tools`，承载 Machine API client、文档工具 dry-run 逻辑和工具 manifest；该包不单独发布到 npm。
- 新增 `@mynotion/mcp-server`，提供独立 `my-notion-mcp-server --transport stdio`。
- 保留 `my-notion mcp serve --transport stdio` 兼容入口。
- 新增 `my_notion_readme`，让 Agent 先通过工具了解调用方式、安全规则和 Markdown 契约。

## 关键决策

- CLI 和 MCP 分别发布，避免 MCP 只是 CLI 子命令。
- 共享层不依赖 MCP SDK，保持 transport-agnostic。
- 第一版继续只支持 STDIO，不做 HTTP MCP / OAuth discovery。
- 写工具继续默认 dry-run，真实写入必须用户确认。

## 验证入口

```bash
pnpm --filter @mynotion/agent-tools test
pnpm --filter @mynotion/mcp-server test
pnpm --filter @mynotion/cli test
pnpm e2e:mcp
pnpm e2e:mcp:client
```
