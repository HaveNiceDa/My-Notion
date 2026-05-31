# My-Notion CLI

面向用户和外部 Agent 的 My-Notion 文档管理 CLI。它通过浏览器授权登录后调用 Convex HTTP Actions，支持创建、读取、搜索、更新、导入、导出和归档文档。

## 当前状态

- 核心命令已可用：`auth`、`docs`、`tokens`、`mcp`。
- MCP STDIO 暴露文档 `search`、`fetch`、`create`、`update` 工具。
- 默认 profile 是 `prod`，默认 Machine API URL 是 `https://laudable-albatross-174.convex.site`，默认 Web URL 是 `https://notion-j9zj.vercel.app`。
- 首次使用执行 `auth login`，CLI 会输出浏览器授权链接；用户登录并确认后，CLI 自动保存认证态到 `~/.my-notion/config.json`。
- 本地调试使用 `--profile local --web-url http://localhost:3000 --api-url <convex-site-url>`，不会污染线上登录态。
- 当本地 token 过期、撤销或失效时，CLI 会提示重新运行 `auth login`，不要求用户复制明文 token。
- 包级单测已覆盖配置解析、输出格式、HTTP client 和 `docs` 命令参数映射。

## 快速开始

```bash
pnpm --filter @notion/my-notion-cli build

node packages/my-notion-cli/dist/index.js auth login \
  --format json

# 本地调试示例
node packages/my-notion-cli/dist/index.js auth login \
  --profile local \
  --web-url http://localhost:3000 \
  --api-url "https://<dev-deployment>.convex.site"

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
