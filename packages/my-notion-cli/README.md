# My-Notion CLI

面向用户和外部 Agent 的 My-Notion 文档管理 CLI。它通过 My-Notion PAT 调用 Convex HTTP Actions，支持创建、读取、搜索、更新、导入、导出和归档文档。

## 当前状态

- 核心命令已可用：`auth`、`docs`、`tokens`、`mcp`。
- MCP STDIO 暴露文档 `search`、`fetch`、`create`、`update` 工具。
- 默认 Machine API URL 是 `https://laudable-albatross-174.convex.site`；只有连接非默认部署时才需要传 `--api-url` 或设置 `MY_NOTION_API_URL`。
- Web 设置页会自动准备一个默认 CLI Token，可隐藏、显示、复制和重置；CLI 只需要消费这个 `mnt_` token。
- 包级单测已覆盖配置解析、输出格式、HTTP client 和 `docs` 命令参数映射。

## 快速开始

```bash
pnpm --filter @notion/my-notion-cli build

node packages/my-notion-cli/dist/index.js auth login \
  --token "mnt_xxx" \
  --format json

node packages/my-notion-cli/dist/index.js docs search \
  --query "项目周报" \
  --format json
```

## 验证

```bash
pnpm --filter @notion/my-notion-cli test
pnpm --filter @notion/my-notion-cli typecheck
pnpm --filter @notion/my-notion-cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
```

## 参考

- 使用说明：[`docs/usage.md`](./docs/usage.md)
- 发布清单：[`../../docs/my-notion-cli-release-checklist.md`](../../docs/my-notion-cli-release-checklist.md)
- Skills 源目录：[`../my-notion-skills`](../my-notion-skills)
