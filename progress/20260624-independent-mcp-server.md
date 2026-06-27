# 2026-06-24 Independent MCP Server

## 背景

原 MCP server 直接内置在 `@mynotion/cli` 的 `my-notion mcp serve --transport stdio` 子命令中，工具注册、dry-run 逻辑和 Machine API client 混在 CLI 包内。这样可用，但 MCP 没有独立发布边界。

## 本阶段调整

- 新增内部 `packages/my-notion-agent-tools`，抽出共享 Machine API client、文档工具 dry-run 逻辑、tool manifest 和 `my_notion_readme`，不单独发布 npm 包。
- 新增 `packages/my-notion-mcp`，提供独立 npm 包 `@mynotion/mcp` 和 bin `my-notion-mcp`。
- CLI 保留 `my-notion mcp serve --transport stdio` 兼容入口，但转调独立 MCP server。
- MCP tools 新增 `my_notion_readme`，帮助 Agent 自发现工具、安全规则和 Markdown 契约。

## 后续验证

```bash
pnpm --filter @mynotion/agent-tools test
pnpm --filter @mynotion/mcp test
pnpm --filter @mynotion/cli test
pnpm e2e:mcp
pnpm e2e:mcp:client
```

## 2026-06-27 npm latest 发布

- `@mynotion/mcp@0.1.2` 已发布到 npm `latest`，包含独立 MCP server、当前 profile 说明和线上优先登录态解析。
- `@mynotion/cli@0.1.1` 已发布到 npm `latest`，依赖 `@mynotion/mcp@^0.1.2`，默认固定走线上 `prod`，只有显式 `--local` / `--profile local` 才使用本地登录态。
- 发布前完成 agent-tools / mcp / cli test、typecheck、build、pack dry-run、skills 同步检查和 `git diff --check`。
- 发布后通过 `npm view` 确认 latest tag，并通过 `npm exec --package @mynotion/cli@latest -- my-notion --help` 与 `npm exec --package @mynotion/mcp@latest -- my-notion-mcp --help` 做启动 smoke。

## 2026-06-27 prod endpoint 漂移修复

- 根因：Web Device Flow 总是在当前 Web 后端创建 PAT，CLI 传入的 `apiUrl` 只作为授权会话展示信息；旧 prod config 中的 `capable-hippopotamus-766.convex.site` 会导致授权成功后拿 token 去旧 Convex 部署校验，从而卡在登录态。
- 修复：默认 `prod` profile 固定使用当前线上 canonical `apiUrl/webUrl`，忽略保存配置里的旧 prod endpoint；保存的 prod token 仍复用。local/custom profile 继续使用各自保存的 endpoint。
- 已发布 `@mynotion/mcp@0.1.3` 和 `@mynotion/cli@0.1.2` 到 npm `latest`。
- 发布后用临时 HOME 写入旧 prod config，验证 `@mynotion/cli@latest config init --check --format json` 仍解析到 `https://moonlit-ptarmigan-478.convex.site` 和 `https://notion-j9zj.vercel.app`。

## 2026-06-27 prod endpoint 漂移修复

- 根因：Web Device Flow 总是在当前 Web 后端创建 PAT，CLI 传入的 `apiUrl` 只作为授权会话展示信息；旧 prod config 中的 `capable-hippopotamus-766.convex.site` 会导致授权成功后拿 token 去旧 Convex 部署校验，从而卡在登录态。
- 修复：默认 `prod` profile 固定使用当前线上 canonical `apiUrl/webUrl`，忽略保存配置里的旧 prod endpoint；保存的 prod token 仍复用。local/custom profile 继续使用各自保存的 endpoint。
- 已发布 `@mynotion/mcp@0.1.3` 和 `@mynotion/cli@0.1.2` 到 npm `latest`。
- 发布后用临时 HOME 写入旧 prod config，验证 `@mynotion/cli@latest config init --check --format json` 仍解析到 `https://moonlit-ptarmigan-478.convex.site` 和 `https://notion-j9zj.vercel.app`。
*** End of File

## 2026-06-27 prod endpoint 漂移修复

- 根因：Web Device Flow 总是在当前 Web 后端创建 PAT，CLI 传入的 `apiUrl` 只作为授权会话展示信息；旧 prod config 中的 `capable-hippopotamus-766.convex.site` 会导致授权成功后拿 token 去旧 Convex 部署校验，从而卡在登录态。
- 修复：默认 `prod` profile 固定使用当前线上 canonical `apiUrl/webUrl`，忽略保存配置里的旧 prod endpoint；保存的 prod token 仍复用。local/custom profile 继续使用各自保存的 endpoint。
- 已发布 `@mynotion/mcp@0.1.3` 和 `@mynotion/cli@0.1.2` 到 npm `latest`。
- 发布后用临时 HOME 写入旧 prod config，验证 `@mynotion/cli@latest config init --check --format json` 仍解析到 `https://moonlit-ptarmigan-478.convex.site` 和 `https://notion-j9zj.vercel.app`。

## 2026-06-27 prod endpoint 漂移修复

- 根因：Web Device Flow 总是在当前 Web 后端创建 PAT，CLI 传入的 `apiUrl` 只作为授权会话展示信息；旧 prod config 中的 `capable-hippopotamus-766.convex.site` 会导致授权成功后拿 token 去旧 Convex 部署校验，从而卡在登录态。
- 修复：默认 `prod` profile 固定使用当前线上 canonical `apiUrl/webUrl`，忽略保存配置里的旧 prod endpoint；保存的 prod token 仍复用。local/custom profile 继续使用各自保存的 endpoint。
- 已发布 `@mynotion/mcp@0.1.3` 和 `@mynotion/cli@0.1.2` 到 npm `latest`。
- 发布后用临时 HOME 写入旧 prod config，验证 `@mynotion/cli@latest config init --check --format json` 仍解析到 `https://moonlit-ptarmigan-478.convex.site` 和 `https://notion-j9zj.vercel.app`。
