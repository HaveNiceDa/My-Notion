# M16: CLI / Skills / MCP Agent 写文档能力交付

## 目标

将 My-Notion 的 Agent 写文档能力从架构规划推进到可交付状态：外部 Agent 可以通过 CLI、Skills 或 MCP STDIO 安全地把 Markdown 内容写入 My-Notion 文档，并具备认证、安全、审计、限流、错误契约、E2E 和发布检查清单。

本阶段的交付目标是 **Agent 写文档**，不是知识库问答或 RAG 检索。`kb search`、`agent ask`、HTTP MCP / OAuth 作为后续规划，不阻塞当前发布。

## 交付范围

### CLI

- `packages/my-notion-cli`
- 命令覆盖：
  - `auth login/status/logout`
  - `tokens revoke-current`
  - `docs create/fetch/search/list/update/archive/import/export`
  - `mcp serve --transport stdio`
- 默认 JSON 输出，支持 `pretty/table/ndjson/markdown`。
- HTTP client 支持超时、重试、requestId 错误透出，并避免重试结构化 `RATE_LIMITED`。
- 2026-05-30 P0-P2 收口后，CLI 增加包级 Vitest 入口和核心单测，默认 Machine API URL 兜底为 `https://laudable-albatross-174.convex.site`。
- 2026-05-31 npm beta 已发布为 `@mynotion/cli@0.1.0-beta.0`，bin 保持 `my-notion`。

### Skills

- `packages/my-notion-skills/my-notion-shared`
- `packages/my-notion-skills/my-notion-docs`
- `packages/my-notion-skills/my-notion-mcp`
- `.trae/skills` 通过 `pnpm sync:skills` 同步。
- `packages/my-notion-cli/skills` 通过 `pnpm sync:skills:package` 同步，随 `@mynotion/cli` npm 包发布。
- `pnpm sync:skills:check` 可检测源 skill、已安装 skill 与 npm 包内 skill 是否漂移。

### MCP

- STDIO MVP 已完成。
- 暴露工具：
  - `my_notion_docs_search`
  - `my_notion_docs_fetch`
  - `my_notion_docs_create`
  - `my_notion_docs_update`
- 写工具默认 `dryRun: true`。
- dry-run 输出明确包含 `confirmationRequired: true` 和 no-write 文案。
- 错误输出统一包含 `isError: true`、`structuredContent.error` 和可读 text fallback。

### Machine API

- Convex HTTP Actions 暴露 `/cli/v1/*`。
- PAT 使用 `mnt_` 前缀，只存储 SHA-256 hash。
- 机器 API 从 PAT 服务端解析 `userId`，不信任客户端传入用户身份。
- 支持 requestId、审计日志、固定窗口限流和错误码契约。

## 关键决策

- CLI / MCP 的当前核心目标是 Agent 写文档，而不是知识库问答。
- MCP 不是替代鉴权机制；MCP STDIO 复用 CLI 配置或环境变量中的 PAT。
- 写操作必须默认安全：
  - CLI 写命令需要显式调用。
  - MCP 写工具默认 dry-run。
- E2E 测试产生的文档必须通过 `docs archive` 软归档，测试 PAT 必须撤销。
- Skills 源目录是 `packages/my-notion-skills`，`.trae/skills` 是同步产物，需要漂移校验。

## 安全与可观测性

- 所有 `/cli/v1/*` 响应包含 body `requestId` 和 header `x-request-id`。
- 审计日志记录 requestId、tokenId、tokenPrefix、userId、endpoint、method、status、duration。
- 审计日志不记录 PAT 明文、token hash 或 query string。
- 限流维度为 `tokenId + method + endpoint`。
- 429 返回 `Retry-After` 和 `x-ratelimit-*` headers。
- CLI client 不重试结构化 `RATE_LIMITED`。

## 验证

完整 release checklist 已执行：

- `pnpm --filter @mynotion/cli typecheck`: ✅
- `pnpm --filter @mynotion/cli build`: ✅
- `pnpm --filter @mynotion/cli test`: ✅
- `pnpm --filter @notion/web exec convex codegen`: ✅
- `pnpm --filter @notion/web typecheck`: ✅
- `pnpm e2e:cli`: ✅
- `pnpm e2e:cli:errors`: ✅
- `pnpm e2e:mcp`: ✅
- `pnpm sync:skills`: ✅
- `pnpm sync:skills:package`: ✅
- `pnpm sync:skills:check`: ✅

验证期间发现并修复：

- `scripts/e2e-my-notion-cli-errors.mjs` 的原生 `fetch` 缺少网络级重试，遇到瞬时 `fetch failed` 会误失败。
- 错误契约 E2E 的限流断言原先假设第 31 次写请求必然 429，遇到固定窗口边界时不稳定；已改为在最多 90 次写请求内等待首个 429。

## 关联文档

- `docs/archive/my-notion-cli-skills-architecture-final-20260526.md`
- `docs/my-notion-cli-release-checklist.md`
- `packages/my-notion-skills/README.md`
- `.trae/documents/my-notion-cli-skills-architecture-plan.md`

## 关联 progress 文件

- 阶段结论以本 milestone 为准，详细过程已压缩到 `progress/20260527-20260531-consolidated.md`。

## 后续规划

- `kb search`：仅在产品目标需要 Agent 检索知识库再回答/生成时启动。
- `agent ask --format ndjson`：需要复用 ReAct Loop，并设计 streaming 事件契约。
- HTTP MCP / OAuth 2.1：远程集成能力，复杂度较高，暂不阻塞当前交付。
- CLI config schema 扩展：必须保持向后兼容。
