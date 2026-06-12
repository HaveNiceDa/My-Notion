# 2026-06-11 P0 Risk Fixes

## 目标

- 修复 P0 风险：凭据暴露、Mobile AI API 契约断层、本地发布 token 明文文件，以及废弃绘图能力的入口收口。
- 完成生产部署、CLI 本地包生成和 Markdown 残留清理，保证当前交付物与下线策略一致。

## 已完成

- 将 `docs/fly-io-deployment-guide.md` 中的 LLM、Qdrant、SerpAPI 示例敏感值替换为占位符，避免继续在已跟踪文档中保留真实密钥样例。
- 删除本地忽略文件 `packages/my-notion-cli/.npmrc.publish`，降低 npm 发布 token 明文留存风险。
- 新增 Web 兼容路由 `/api/chat` 与 `/api/rag`，复用 `@notion/ai/server` 流式能力并接入 Clerk 鉴权、基础限流、SSE 输出和 CORS header。
- Mobile AI Client 请求 `/api/chat`、`/api/rag` 时携带 Clerk Bearer token，避免兼容路由成为未鉴权 LLM 入口。
- 废弃绘图能力的 Web、CLI、MCP 和 Machine API 入口已完成收口；生产 Convex 已部署。
- 已生成新的 CLI npm tarball：`packages/my-notion-cli/mynotion-cli-0.1.0-beta.1.tgz`。
- Markdown 文档已清理旧能力字段和过期专项记录。

## 已知限制

- 已暴露过的密钥需要在外部平台轮换；代码层只能完成脱敏，不能撤销历史泄露。
- Mobile AI 仍是轻量 `/api/chat` / `/api/rag` 兼容层，尚未接入 Web Agent `/api/agent/stream` 的完整 tool-result、confirmation、resume 协议。

## 验证

- `pnpm install --lockfile-only`：通过。
- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm --filter @mynotion/cli typecheck`：通过。
- `pnpm --filter @mynotion/cli test`：通过，9 个测试文件、35 个用例通过。
- `pnpm sync:skills`、`pnpm sync:skills:package`、`pnpm sync:skills:check`：通过。
- `pnpm --filter @notion/web exec convex deploy --yes`：通过，已部署到 `moonlit-ptarmigan-478`。
- Markdown 内容和文件名复查：目标关键词无命中。
