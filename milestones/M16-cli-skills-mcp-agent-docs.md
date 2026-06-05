# M16: CLI / Skills / MCP Agent 写文档能力交付

## 状态总览

- 状态：已交付。
- 更新时间：2026-06-02。
- 本阶段交付目标：外部 Agent 可以通过 CLI、Skills 或 MCP STDIO 安全地把 Markdown 内容写入 My-Notion 文档。
- 本阶段非目标：知识库问答、RAG 检索、远程 HTTP MCP、OAuth、通用 Agent Ask 流式接口。

## 目标

将 My-Notion 的 Agent 写文档能力从架构规划推进到可交付状态：外部 Agent 可以通过 CLI、Skills 或 MCP STDIO 安全地把 Markdown 内容写入 My-Notion 文档，并具备认证、安全、审计、限流、错误契约、E2E 和发布检查清单。

本阶段的交付目标是 **Agent 写文档**，不是知识库问答或 RAG 检索。`kb search`、`agent ask`、HTTP MCP / OAuth 作为后续规划，不阻塞当前发布。

## 已完成

### CLI

- 已完成 `packages/my-notion-cli` 交付。
- 已覆盖 `auth login/status/logout`、`config init`、`tokens revoke-current`、`docs create/fetch/search/list/update/archive/import/export`、`mcp serve --transport stdio`。
- 已支持默认 JSON 输出，并支持 `pretty/table/ndjson/markdown`。
- 已支持 HTTP client 超时、重试、requestId 错误透出，并避免重试结构化 `RATE_LIMITED`。
- 已加固 Node 网络稳定性：设置 `autoSelectFamilyAttemptTimeout`，降低 Convex/Cloudflare `fetch failed` 抖动。
- 已增加包级 Vitest 入口和核心单测。
- 已设置默认 Machine API URL 兜底为 `https://moonlit-ptarmigan-478.convex.site`。
- 已发布 npm beta：`@mynotion/cli@0.1.0-beta.0`，bin 保持 `my-notion`。
- 已补 `my-notion config init` 初始化入口，覆盖 Node/配置/登录态/Skills/MCP 状态检查和下一步命令推荐；命令只写入非敏感 profile 元信息，不输出完整 Token。

### Skills

- 已完成 `packages/my-notion-skills/my-notion-shared`、`packages/my-notion-skills/my-notion-docs`、`packages/my-notion-skills/my-notion-mcp`。
- 已通过 `pnpm sync:skills` 同步到 `.trae/skills`。
- 已通过 `pnpm sync:skills:package` 同步到 `packages/my-notion-cli/skills`，随 `@mynotion/cli` npm 包发布。
- 已提供 `pnpm sync:skills:check`，用于检测源 skill、已安装 skill 与 npm 包内 skill 是否漂移。
- 已明确 Skills 安全边界：不输出完整 PAT，写入前必须遵循 dry-run/preview/confirmation 规则。

### MCP STDIO

- 已完成 STDIO MVP。
- 已暴露 `my_notion_docs_search`、`my_notion_docs_fetch`、`my_notion_docs_create`、`my_notion_docs_update`。
- 已设置写工具默认 `dryRun: true`。
- 已在 dry-run 输出中明确包含 `confirmationRequired: true` 和 no-write 文案。
- 已统一错误输出：包含 `isError: true`、`structuredContent.error` 和可读 text fallback。
- 已新增 `pnpm e2e:mcp:client`，使用真实 `@modelcontextprotocol/sdk` Client + `StdioClientTransport` 验证工具发现、认证失败、dry-run、确认式真实写入、读取、追加、搜索、归档和测试 PAT 撤销。

### Machine API

- 已通过 Convex HTTP Actions 暴露 `/cli/v1/*`。
- 已支持 `POST /cli/v1/documents`、`GET/PATCH/DELETE /cli/v1/documents/:id` 等文档接口。
- 已实现 PAT 认证，Token 使用 `mnt_` 前缀，只存储 SHA-256 hash。
- 已从 PAT 服务端解析 `userId`，不信任客户端传入用户身份。
- 已支持 requestId、审计日志、固定窗口限流和错误码契约。
- 已确保所有 `/cli/v1/*` 响应包含 body `requestId` 和 header `x-request-id`。
- 已确保审计日志记录 requestId、tokenId、tokenPrefix、userId、endpoint、method、status、duration。
- 已确保审计日志不记录 PAT 明文、token hash 或 query string。
- 已确保限流维度为 `tokenId + method + endpoint`，429 返回 `Retry-After` 和 `x-ratelimit-*` headers。

### Markdown 写入格式

- 已决策 Agent 对外统一读写 Markdown，服务端负责 Markdown <-> BlockNote blocks 双向转换。
- 已实现 `contentMarkdown` 创建、更新、读取和导出链路。
- 已覆盖 heading、列表、checklist、quote、code block、divider、inline bold/italic/code/link、append 等常用结构。
- 已明确 BlockNote JSON 仅作为内部编辑器存储格式，普通 Agent 不直接生成或解析 BlockNote JSON。

### Web Agent 写文档

- 已完成 `document_write`、`document_update` 的 dry-run 预览契约。
- 已在 tool schema 中明确要求输入 Markdown，禁止 Agent 生成 BlockNote JSON。
- 已通过 Tool 卡片接入用户确认入口，真实写入由前端确认后触发。
- 已保持 Web Agent 写入链路符合 `Dry-run -> Preview -> User Confirmation -> Commit` 安全链。

## 关键决策

- CLI / MCP 的当前核心目标是 Agent 写文档，而不是知识库问答。
- Agent 对外读写文档统一使用 Markdown；服务端负责 Markdown <-> BlockNote blocks 双向转换，BlockNote JSON 仅作为内部编辑器存储格式。
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
- `pnpm e2e:mcp:client`: ✅
- `pnpm sync:skills`: ✅
- `pnpm sync:skills:package`: ✅
- `pnpm sync:skills:check`: ✅

验证期间发现并修复：

- `scripts/e2e-my-notion-cli-errors.mjs` 的原生 `fetch` 缺少网络级重试，遇到瞬时 `fetch failed` 会误失败。
- 错误契约 E2E 的限流断言原先假设第 31 次写请求必然 429，遇到固定窗口边界时不稳定；已改为在最多 90 次写请求内等待首个 429。

## 未完成或后置

- `kb search`：未做；仅在产品目标需要 Agent 检索知识库再回答或生成时启动，不阻塞 M16。
- `agent ask --format ndjson`：未做；需要复用 ReAct Loop，并单独设计 streaming 事件契约，不阻塞 M16。
- HTTP MCP / OAuth 2.1：未做；属于远程集成能力，复杂度较高，不阻塞 M16。
- Web Agent MCP adapter：未做；属于下一阶段候选方向，用于让 Web Agent 安全调用受控 MCP 工具。
- 更完整的 Markdown <-> BlockNote 转换覆盖：部分完成；当前已覆盖 Agent 写文档常用结构，复杂 BlockNote 能力后续按真实文档 case 增强。
- 更真实的全局 Skills 安装探测和 npm 版本更新提示：部分完成；`config init` 已提供首版状态检查，后续可继续增强。
- 更多第三方 MCP Client 兼容性验证：部分完成；当前已通过真实 MCP SDK Client 验证，后续可扩展到更多客户端体验验证。
- CLI config schema 扩展：未展开；后续如需扩展必须保持向后兼容。

## 关联文档

- `docs/my-notion-cli-release-checklist.md`
- `docs/agent-document-write-format-strategy.md`
- `docs/ai-chat-refactor-plan.md`
- `milestones/M19-plan-mode-minimal-loop.md`
- `packages/my-notion-skills/README.md`
- `.trae/documents/my-notion-cli-skills-architecture-plan.md`

## 关联 progress 文件

- 阶段结论以本 milestone 为准，详细过程已压缩到 `progress/20260527-20260531-consolidated.md`。

## 后续规划

- Plan 模式最小闭环：已在 M19 完成，支持计划生成、用户确认、确认后执行和状态展示。
- Web Agent MCP adapter：让 Web Agent 安全调用受控 MCP 工具。
- `kb search`：仅在产品目标需要 Agent 检索知识库再回答或生成时启动。
- `agent ask --format ndjson`：复用 ReAct Loop，并设计 streaming 事件契约。
- HTTP MCP / OAuth 2.1：作为远程集成能力后续规划。
- CLI config schema 扩展：必须保持向后兼容。
- Markdown <-> BlockNote 转换增强：按真实复杂文档 case 继续补齐。
