# 2026-05-31 CLI 授权与 Agent 输出优化

## 背景

用户反馈 CLI 授权链路存在 4 个体验问题：

- 线上与本地登录态容易混用，默认入口应始终是线上。
- 授权页点击授权后缺少明确反馈，应提示即将返回文档首页。
- CLI Skills 给 Agent 的提示过细，容易把登录态、配置路径等内部信息输出给用户。
- Agent 给出的授权 URL 应明确使用可点击链接，而不是纯文本。

## 改动

- CLI 配置按环境隔离：
  - 线上 `prod` 使用 `~/.local/share/my-notion/config.json`。
  - 本地 `local` 使用 `~/.local/share/my-notion/config.local.json`。
  - 默认 profile 不再读取上次登录的 `activeProfile`，默认入口始终是 `prod`。
- CLI 帮助、README、使用文档和发布清单同步说明 `--local` 调试入口与独立配置文件。
- CLI 授权页在批准后使用 `sonner` toast 提示“授权成功，5 秒后返回文档首页”，并跳转到当前 locale 下的 `/documents`。
- `my-notion-shared`、`my-notion-docs`、`my-notion-mcp` skill 文档改为要求：
  - 授权 URL 必须用 Markdown 链接形式输出。
  - 用户可见回复只保留操作结果和文档 ID 等核心信息。
  - 不默认输出 auth status JSON、config path、token prefix、profile 细节或原始 CLI JSON。
- 已运行 `pnpm sync:skills`，并用 `pnpm sync:skills:check` 验证 `.trae/skills` 无漂移。

## 验证

- `pnpm --filter @notion/my-notion-cli test`：通过。
- `pnpm --filter @notion/my-notion-cli typecheck`：通过。
- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm sync:skills`：通过。
- `pnpm sync:skills:check`：通过。
- VS Code diagnostics：无新增错误。
