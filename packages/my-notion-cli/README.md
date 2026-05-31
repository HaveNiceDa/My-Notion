# My-Notion CLI

面向用户和外部 Agent 的 My-Notion 文档管理 CLI。它通过浏览器授权登录后调用 Convex HTTP Actions，支持创建、读取、搜索、更新、导入、导出和归档文档。

## 当前状态

- 核心命令已可用：`auth`、`docs`、`tokens`、`mcp`。
- MCP STDIO 暴露文档 `search`、`fetch`、`create`、`update` 工具。
- 默认 profile 是 `prod`，默认 Machine API URL 是 `https://laudable-albatross-174.convex.site`，默认 Web URL 是 `https://notion-j9zj.vercel.app`。
- 首次使用执行 `auth login`，CLI 会输出只包含 `user_code` 的浏览器授权链接；用户登录并确认后，CLI 自动保存线上认证态到 `~/.local/share/my-notion/config.json`。
- `device_code` 是 CLI 本地持有的一次性临时凭据，不会出现在授权 URL 中；不要把它粘贴到聊天、日志或公开文档。
- 本地配置目录使用 `0700`，配置文件使用 `0600`；特殊权限环境可用 `MY_NOTION_CONFIG_PATH` 指向可写配置文件。
- 默认入口始终是线上 `prod`；本地调试使用 `--local --web-url http://localhost:3000 --api-url <convex-site-url>`，登录态单独保存到 `~/.local/share/my-notion/config.local.json`，不会污染线上登录态。
- 当本地 token 过期、撤销或失效时，CLI 会提示重新运行 `auth login`，不要求用户复制明文 token。
- 包级单测已覆盖配置解析、输出格式、HTTP client 和 `docs` 命令参数映射。

## 快速开始

```bash
pnpm --filter @notion/my-notion-cli build

node packages/my-notion-cli/dist/index.js auth login \
  --format json

# 本地调试示例
node packages/my-notion-cli/dist/index.js auth login \
  --local \
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
