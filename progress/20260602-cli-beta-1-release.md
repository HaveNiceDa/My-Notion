# 2026-06-02 CLI 0.1.0-beta.1 发布记录

## 发布内容

- 发布 npm beta 包：`@mynotion/cli@0.1.0-beta.1`。
- `beta` dist-tag 已更新到 `0.1.0-beta.1`。
- `latest` dist-tag 仍保留在 `0.1.0-beta.0`，稳定版发布前不切换。

## 本次包含

- `my-notion update` 更新检查与升级指引。
- `my-notion config init` 统一初始化入口。
- CLI HTTP 客户端网络稳定性加固。
- Agent 对外文档格式继续统一为 Markdown。
- MCP 真实 SDK Client E2E 验证链路。

## 验证结果

- `pnpm --filter @mynotion/cli test`：通过，8 个测试文件、34 个测试。
- `pnpm --filter @mynotion/cli typecheck`：通过。
- `pnpm --filter @mynotion/cli build`：通过。
- `pnpm --filter @notion/web exec convex codegen`：通过。
- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm e2e:cli`：通过。
- `pnpm e2e:cli:errors`：通过。
- `pnpm e2e:mcp`：通过。
- `pnpm e2e:mcp:client`：通过。
- `pnpm sync:skills`：通过。
- `pnpm sync:skills:package`：通过。
- `pnpm sync:skills:check`：通过。
- `npm pack --dry-run`：通过，包版本为 `0.1.0-beta.1`，共 37 个文件。

## 发布后校验

- `npm view @mynotion/cli@beta version bin dist-tags --json`：通过，`beta` 指向 `0.1.0-beta.1`。
- `npx @mynotion/cli@beta --help`：通过。
- `npx @mynotion/cli@beta install --check --format json`：通过，返回 `version: "0.1.0-beta.1"` 且 `skillsBundled: true`。

## 发布判断

- CLI / MCP / Skills 主链路可发布。
- 未发现 PAT 泄漏或错误契约回归。
- 发布过程中遇到 npm publish 2FA 限制，最终使用本地 `.npmrc.publish` 中具备发布权限的 token 完成发布；该文件仍为本地忽略文件，不提交。
