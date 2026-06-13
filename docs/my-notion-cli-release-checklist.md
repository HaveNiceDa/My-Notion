# My-Notion CLI / MCP Release Checklist

本清单用于发布或交付 CLI / Skills / MCP Agent 写文档能力前的最终检查。目标是确认 Agent 可以安全、稳定地通过 CLI 或 MCP STDIO 把 Markdown 内容写入 My-Notion 文档。当前 beta 已发布，后续版本发布仍按本清单执行。

## 适用范围

- `packages/my-notion-cli`
- `packages/my-notion-skills`
- `.trae/skills`
- `/cli/v1/*` Machine API
- MCP STDIO server：`my-notion mcp serve --transport stdio`

## 发布前命令

按顺序运行：

```bash
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm --filter @notion/web exec convex codegen
pnpm --filter @notion/web typecheck
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
cd packages/my-notion-cli && npm pack --dry-run
```

如改动影响 Web UI、PAT 管理入口或 Next.js API，再追加：

```bash
pnpm --filter @notion/web build
pnpm --filter @notion/web lint
```

## 功能检查

- `auth login` 能通过浏览器 Device Flow 完成授权并保存 `apiUrl` 与 PAT 到本地配置。
- 授权 URL 只包含 `user_code`，不得包含 `device_code`。
- `auth status` 能返回 token prefix、scopes、expiresAt，不泄漏完整 PAT。
- `docs create` 能从 Markdown 文件创建文档。
- `docs fetch --format markdown` 能返回文档正文。
- `docs update --mode append` 能追加内容。
- `docs export` 能把文档导出为 Markdown 文件。
- `docs import` 能把 Markdown 文件导入为新文档。
- `docs archive` 能软归档测试文档，并且归档后不再出现在正常 search/list/fetch 结果中。
- `tokens revoke-current` 能撤销当前 PAT。
- MCP STDIO 能完成 `initialize`、`tools/list`、dry-run 写工具和真实 create/fetch/update/search 链路。
- MCP 写工具 dry-run 结果必须包含 `dryRun: true`、`confirmationRequired: true`、明确的 no-write 文案和稳定 `structuredContent`。
- MCP 错误结果必须包含 `isError: true`、`structuredContent.error.message` 和可读 text fallback；如后端返回 `requestId`，必须透出。

## 错误契约检查

`pnpm e2e:cli:errors` 必须覆盖并通过：

- `401 UNAUTHORIZED`
- `401 TOKEN_REVOKED`
- `401 TOKEN_EXPIRED`
- `403 INSUFFICIENT_SCOPE`
- `404 NOT_FOUND`
- `422 VALIDATION_ERROR`
- `429 RATE_LIMITED`
- 响应 body `requestId` 与 `x-request-id` header 一致。
- `429` 包含 `Retry-After`、`x-ratelimit-limit`、`x-ratelimit-remaining`、`x-ratelimit-reset`。

## 安全检查

- PAT 明文不得写入仓库、文档、日志或测试输出。
- 只允许展示 `tokenPrefix`。
- MCP 写工具默认 `dryRun: true`。
- MCP dry-run 文案必须明确说明没有创建或更新真实 My-Notion 文档。
- CLI 写命令必须由用户或 Agent 显式调用。
- Machine API 不信任客户端传入的 `userId`，必须由 PAT 服务端解析。
- 审计日志不得记录 PAT 明文、token hash 或 query string。
- CLI client 不重试结构化 `RATE_LIMITED` 错误。

## Skills 同步检查

运行：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

然后确认：

- `packages/my-notion-skills/my-notion-docs` 已同步到 `.trae/skills/my-notion-docs`。
- `packages/my-notion-skills/my-notion-mcp` 已同步到 `.trae/skills/my-notion-mcp`。
- `packages/my-notion-skills/my-notion-shared` 已同步到 `.trae/skills/my-notion-shared`。
- `packages/my-notion-skills/my-notion-docs` 已同步到 `packages/my-notion-cli/skills/my-notion-docs`。
- `packages/my-notion-skills/my-notion-mcp` 已同步到 `packages/my-notion-cli/skills/my-notion-mcp`。
- `packages/my-notion-skills/my-notion-shared` 已同步到 `packages/my-notion-cli/skills/my-notion-shared`。
- `pnpm sync:skills:check` 返回 `success: true`，不存在缺失、额外或内容不一致的文件。
- skill 文档仍要求长内容使用临时 Markdown 文件。
- skill 文档仍禁止在聊天或日志中输出完整 PAT。

## npm latest 发布检查

npm 包信息：

```text
package: @mynotion/cli
bin:     my-notion
tag:     latest
current latest: 0.1.0
```

发布前必须确认：

- `npm whoami` 能返回当前 npm 用户。
- `npm config get registry` 和 `pnpm config get registry` 必须都是 `https://registry.npmjs.org/`，不得使用公司内部源或镜像源发布。
- 当前 npm 用户拥有 `@mynotion` organization/scope 的 publish 权限。
- `@mynotion/cli` 使用 `publishConfig.access = public` 或发布时显式传 `--access public`。
- `npm pack --dry-run` 只包含 `dist`、`README.md`、`docs`、`skills`、`LICENSE`、`CHANGELOG.md`、`package.json` 等预期文件。
- 本地 tarball 安装后 `my-notion --help`、`my-notion install --check`、`my-notion auth login --no-open` 可运行。
- Skills 安装命令为 `npx skills add @mynotion/cli -y -g`；如果该工具不支持 npm package source，立即切换到 GitHub URL 或 `my-notion install --skills` 方案。

发布命令：

```bash
cd packages/my-notion-cli
npm publish --tag beta --access public
# 如使用本地 token 文件：npm publish --tag beta --access public --userconfig ./.npmrc.publish
npm view @mynotion/cli@latest version bin dist-tags
npx @mynotion/cli@latest --help
```

稳定版发布后再切 latest：

```bash
npm dist-tag add @mynotion/cli@0.1.0 latest
```

## 配置兼容性

当前 CLI 配置按环境隔离：

```text
线上 prod：~/.local/share/my-notion/config.json
本地 local：~/.local/share/my-notion/config.local.json
```

配置读取优先级：

1. 命令行参数：`--api-url`、`--token`
2. 环境变量：`MY_NOTION_API_URL`、`MY_NOTION_API_TOKEN`
3. 本地配置：线上 `config.json`，本地 `config.local.json`
4. 默认线上地址：`https://moonlit-ptarmigan-478.convex.site`

后续如扩展 config schema，必须保持向后兼容：

- 新字段必须可选。
- 旧配置文件缺少新字段时不能导致 CLI 启动失败。
- 写回配置时不得写入未知敏感字段。
- 如需要破坏性迁移，必须先在架构文档中补充迁移策略。

## 发布结论模板

发布前或发布后在 `progress/` 阶段摘要中记录：

```markdown
## 验证结果

- `pnpm --filter @mynotion/cli typecheck`：通过
- `pnpm --filter @mynotion/cli test`：通过
- `pnpm --filter @mynotion/cli build`：通过
- `pnpm --filter @notion/web exec convex codegen`：通过
- `pnpm --filter @notion/web typecheck`：通过
- `pnpm e2e:cli`：通过
- `pnpm e2e:cli:errors`：通过
- `pnpm e2e:mcp`：通过
- `pnpm sync:skills`：通过
- `pnpm sync:skills:package`：通过
- `pnpm sync:skills:check`：通过
- `npm pack --dry-run`：通过

## 发布判断

- Agent 写文档链路可发布。
- 未发现 PAT 泄漏或错误契约回归。
```
