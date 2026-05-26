# My-Notion CLI 与 Skills 技术方案

## Summary

本方案面向 My-Notion 的 Agent 生态扩展，新增两个 monorepo package：

- `packages/my-notion-cli`：提供 `my-notion` 命令行工具，给人类用户和外部 Agent 提供稳定、机器友好的文档操作入口。
- `packages/my-notion-skills`：提供 Agent Skills 文档与引用资料，让 Agent 知道何时、如何、安全地调用 `my-notion` CLI。

本方案最初定位为架构蓝图；截至 2026-05-26，MVP 主链路已经落地，核心能力聚焦文档 CRUD：

- 创建文档：Agent 可把 Markdown 内容生成到 My-Notion。
- 读取文档：Agent 可根据文档 ID 获取标题和内容。
- 更新文档：Agent 可覆盖、追加或局部替换 Markdown 内容。
- 搜索/列出文档：Agent 可查找用户已有文档。
- 鉴权：采用 My-Notion Personal Access Token（PAT / API Token），CLI 本地保存 token，服务端按 token 映射到 `userId`。

MCP 不建议作为“替代鉴权”的首版核心。MCP HTTP transport 本身仍然需要 OAuth 2.1 / Bearer Token；MCP STDIO transport 通常从环境变量或本地凭据读取认证信息。因此 MCP 更适合定位为 CLI/REST 能力之上的 Agent 适配层，而不是绕过登录鉴权的机制。

## Implementation Status

截至 2026-05-26，CLI / Skills 方案已经从规划进入 MVP 落地状态：

- Phase 1 机器 API 与 Token 地基：已完成。已实现 `apiTokens` schema、PAT 创建/撤销/校验、`/cli/v1/*` Convex HTTP Actions、Web PAT 管理 API。
- Phase 2 CLI MVP：已完成。当前包名为 `@notion/my-notion-cli`，路径为 `packages/my-notion-cli`，支持 `auth`、`tokens`、`docs` 命令和 JSON/pretty/table/markdown 输出。
- Phase 3 Skills MVP：已完成。当前包名为 `@notion/my-notion-skills`，路径为 `packages/my-notion-skills`，包含 `my-notion-shared`、`my-notion-docs`、`my-notion-mcp`，并通过 `pnpm sync:skills` 同步到 `.trae/skills`。
- Phase 4 MCP Adapter：已完成 STDIO MVP。`my-notion mcp serve --transport stdio` 已暴露 `my_notion_docs_search`、`my_notion_docs_fetch`、`my_notion_docs_create`、`my_notion_docs_update`，写操作默认 `dryRun: true`。
- E2E 验证：已新增 `pnpm e2e:cli` 与 `pnpm e2e:mcp`，覆盖 CLI 文档 CRUD、PAT 生命周期、MCP JSON-RPC STDIO 调用。

当前下一阶段重点不是继续补 MVP 主链路，而是进入 Phase 5 前的加固：测试文档清理、限流、审计日志，以及后续 `docs import/export`、`agent ask`、HTTP MCP OAuth 等增强能力。

## Current State Analysis

### Monorepo 现状

- 根目录 `package.json` workspaces 包含 `apps/*` 和 `packages/*`。
- `pnpm-workspace.yaml` 还包含 `services/*`。
- 当前 `packages` 下已有：
  - `packages/ai`：AI、RAG、工具、服务端 AI 逻辑。
  - `packages/business`：共享状态、i18n、类型、工具函数。
  - `packages/convex`：Convex schema、documents、chat 业务逻辑。

### 文档数据与能力边界

- 文档表位于 `packages/convex/schemas/document.ts`。
- 文档字段包括 `title`、`userId`、`content`、`parentDocument`、`isArchived`、`isPublished`、`isStarred`、`isInKnowledgeBase`、`lastEditedTime`。
- 现有文档创建逻辑位于 `packages/convex/documents/logic/create.ts`。
- 现有文档更新逻辑位于 `packages/convex/documents/logic/update.ts`。
- 现有文档搜索逻辑位于 `packages/convex/documents/logic/getSearch.ts`。
- 这些 Convex query/mutation 当前依赖 `context.auth.getUserIdentity()`，身份来自 Clerk，不能被外部 CLI 直接安全复用。

### API 与鉴权现状

- Web 端 API 位于 `apps/web/src/app/api/`。
- `/api/agent/stream`、`/api/rag-documents`、`/api/editor-ai/streamText` 使用 Clerk `auth()` 校验登录。
- `/api/rag-documents` 服务端虽然接收前端 body，但实际以 Clerk `auth()` 的 `userId` 为准。
- 已新增面向 CLI/Agent 的 Personal Access Token 表和 `/cli/v1/*` 机器 API；Web 登录态只负责 PAT 管理，CLI 文档 API 依赖 PAT。

### 飞书 CLI 可借鉴点

- Agent-native：命令和输出以 Agent 成功调用为目标，而不是只服务人类终端体验。
- 三层命令思想：快捷命令优先，底层 API 能力可逐步扩展。
- Skills 文档：每个能力域单独写 skill，包含前置条件、命令示例、格式约束、风险提示。
- 结构化输出：默认 JSON，支持 pretty/table/ndjson，便于 Agent 和 shell 管道消费。
- Dry-run：有副作用命令支持预览。
- 安全边界：明确提示 token 风险、权限范围、危险操作确认。

### MCP 调研结论

- MCP Tools 适合把文档创建、读取、搜索等能力暴露给模型自动调用。
- MCP HTTP authorization 是可选但推荐的协议层能力，本质仍使用 OAuth 2.1 / Bearer Token。
- MCP STDIO 不推荐走 OAuth discovery，通常从环境变量或本地凭据读取认证信息。
- 因此本项目更合理的顺序是：
  - 先建设稳定的 My-Notion API Token + REST/HTTP 能力层。
  - CLI 作为人工和 Agent 的通用入口。
  - Skills 教 Agent 如何使用 CLI。
  - MCP 作为第二适配层复用同一 API client 和 token store。

## Architecture Decision

### 总体架构

```text
Agent / Human
  |
  | my-notion CLI
  v
packages/my-notion-cli
  |
  | HTTPS + Bearer my-notion PAT
  v
Convex HTTP Actions / My-Notion Machine API
  |
  | validate token -> resolve userId -> internal document operations
  v
Convex documents table
```

Skills 与 MCP 的关系：

```text
packages/my-notion-skills
  -> 告诉 Agent 如何调用 my-notion CLI

MCP adapter（已完成 STDIO MVP）
  -> 把同一批 document operations 暴露为 MCP tools
  -> 仍复用 API Token / OAuth 颁发出的 Bearer Token
```

### 为什么不让 CLI 直接调用现有 Convex query/mutation

- 现有 query/mutation 使用 Clerk 身份，CLI 没有浏览器登录态。
- 如果新增公开 Convex function 并允许传入 `userId`，会破坏当前“不信任客户端 userId”的安全边界。
- 更稳妥的做法是新增机器 API 边界：先校验 API Token，再在服务端内部解析出 `userId`，由内部函数执行文档操作。

### 推荐后端边界

优先采用 Convex HTTP Actions：

- `apps/web/convex/http.ts`：挂载 HTTP routes，例如 `/cli/v1/documents`。
- `packages/convex/cli/`：放置 token 校验和文档内部操作逻辑。
- `packages/convex/schemas/apiTokens.ts`：新增 API Token 表。

原因：

- 文档数据就在 Convex，HTTP Actions 能通过 `ctx.runQuery` / `ctx.runMutation` 调用内部函数。
- 不需要在 Next.js API Route 中绕过 Clerk 身份模型。
- 生产环境可以使用 Convex `.site` URL 作为机器 API base URL。

备选方案：

- Next.js API Routes 作为外层代理，内部调用 Convex HTTP Actions。
- 适合后续统一走 Vercel 域名、Sentry、Web middleware，但首版会多一层转发。

## Proposed Changes

### 1. 已实现 `packages/my-notion-cli`

路径：

- `packages/my-notion-cli/package.json`
- `packages/my-notion-cli/tsconfig.json`
- `packages/my-notion-cli/src/index.ts`
- `packages/my-notion-cli/src/commands/auth.ts`
- `packages/my-notion-cli/src/commands/docs.ts`
- `packages/my-notion-cli/src/commands/tokens.ts`
- `packages/my-notion-cli/src/commands/mcp.ts`
- `packages/my-notion-cli/src/client/http-client.ts`
- `packages/my-notion-cli/src/config/store.ts`
- `packages/my-notion-cli/src/format/output.ts`
- `packages/my-notion-cli/src/mcp/server.ts`
- `packages/my-notion-cli/src/types.ts`

职责：

- 提供 npm binary：`my-notion`。
- 默认输出 JSON，支持 `--format json|pretty|table|ndjson`。
- 所有命令支持 `--api-url`，默认从配置或 `MY_NOTION_API_URL` 读取。
- 所有需要身份的命令从配置、环境变量 `MY_NOTION_API_TOKEN` 或 `--token` 读取 PAT。
- CLI 写操作通过显式命令执行；MCP 写工具默认 `dryRun: true`，避免 Agent 误写。

当前实现依赖：

- 自研轻量参数解析：减少 CLI MVP 依赖面。
- `zod`：MCP tool schema 与参数校验。
- Node 18+ 原生 `fetch`：HTTP 调用。
- 本地 JSON 配置：`~/.my-notion/config.json`。
- `@modelcontextprotocol/sdk`：STDIO MCP server。

当前已实现命令：

```bash
my-notion auth login --api-url https://<convex-site-or-web-domain> --token mnt_xxx
my-notion auth status
my-notion auth logout
my-notion tokens revoke-current
my-notion docs create --title "标题" --content-file ./draft.md --format json
my-notion docs fetch --id <documentId> --format markdown
my-notion docs update --id <documentId> --content-file ./draft.md --mode overwrite
my-notion docs update --id <documentId> --content "补充内容" --mode append
my-notion docs search --query "关键词" --limit 10
my-notion docs list --limit 20
my-notion mcp serve --transport stdio
```

输出约定：

```json
{
  "success": true,
  "data": {
    "id": "documentId",
    "title": "标题",
    "url": "https://my-notion.example.com/documents/documentId"
  },
  "requestId": "req_xxx"
}
```

错误约定：

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or expired API token"
  },
  "requestId": "req_xxx"
}
```

### 2. 已实现 `packages/my-notion-skills`

路径：

- `packages/my-notion-skills/package.json`
- `packages/my-notion-skills/README.md`
- `packages/my-notion-skills/my-notion-shared/SKILL.md`
- `packages/my-notion-skills/my-notion-docs/SKILL.md`
- `packages/my-notion-skills/my-notion-docs/references/cli-commands.md`
- `packages/my-notion-skills/my-notion-mcp/SKILL.md`

职责：

- `my-notion-shared`：安装、配置、认证、安全规则、输出格式、dry-run 规则。
- `my-notion-docs`：文档 CRUD 的 Agent 使用指南。
- `my-notion-mcp`：说明何时使用 MCP server，何时使用 CLI。

`my-notion-docs` skill 的核心规则：

- 创建文档默认使用 Markdown。
- Agent 生成长文档时优先写入临时 `.md` 文件，再用 `--content-file`，避免 shell quoting 失败。
- MCP 写操作先使用 `dryRun: true` 预览；CLI 写操作在用户明确授权后再执行。
- 读取/搜索命令优先使用 `--format json`，便于 Agent 解析。
- 不在命令参数中暴露 token；优先使用本地配置或环境变量。

### 3. 已实现 API Token 数据模型

路径：

- `packages/convex/schemas/apiTokens.ts`
- `packages/convex/schemas/index.ts`

建议 schema：

```ts
apiTokens: {
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt?: number;
  expiresAt?: number;
  revokedAt?: number;
}
```

索引：

- `by_token_hash`
- `by_user`

Token 规则：

- 明文 token 只在创建时展示一次。
- 存储时只保存 SHA-256 hash。
- token 建议前缀：`mnt_`。
- 默认 scope：`docs:read`、`docs:write`。
- 后续扩展：`kb:read`、`kb:write`、`agent:run`。

### 4. 已实现机器 API / Convex HTTP Actions

路径：

- `apps/web/convex/http.ts`
- `packages/convex/cli/index.ts`

当前核心 endpoints：

```text
GET  /cli/v1/auth/status
POST /cli/v1/tokens/revoke-current
GET  /cli/v1/documents
POST /cli/v1/documents
GET  /cli/v1/documents/:id
PATCH /cli/v1/documents/:id
GET  /cli/v1/documents/search?q=...&limit=...
```

认证流程：

```text
Authorization: Bearer mnt_xxx
  -> hash token
  -> query apiTokens.by_token_hash
  -> reject revoked / expired token
  -> check required scope
  -> resolve userId
  -> run internal document operation
```

文档写入格式：

- 当前 API 接收 `contentMarkdown`，服务端转换为 BlockNote JSON 存储。
- 服务端已通过 `markdownToBlockNoteJson` / `appendMarkdownToBlockNoteJson` 做 Markdown 到 BlockNote JSON 的简化转换。
- 当前采用方案 A：不修改文档 schema，直接保存兼容编辑器的 BlockNote JSON。复杂 block fidelity 后续再增强。

### 5. Token 创建与管理入口

当前实现：

- Web 设置页已支持生成 PAT，用户复制到 CLI。
- CLI 使用：

```bash
my-notion auth login --api-url https://xxx --token mnt_xxx
```

已实现的 Web/API 能力：

- `POST /api/cli/tokens`：在 Clerk 登录态下创建 token。
- `GET /api/cli/tokens`：列出当前用户 token 元信息。
- `DELETE /api/cli/tokens?tokenId=...`：撤销 token。

注意：

- 这些 token 管理 API 可以继续使用 Next.js API Route + Clerk `auth()`。
- 真正的 CLI 文档 API 不依赖 Clerk，而依赖 PAT。

### 6. MCP 适配设计

MCP STDIO MVP 已完成，当前方案保留 HTTP MCP / OAuth 作为后续增强：

路径选择：

- 简单阶段：`packages/my-notion-cli/src/mcp/`，作为 CLI package 内的 `my-notion mcp serve` 子命令。
- 复杂阶段：拆出 `packages/mcp`，当 MCP server 生命周期、transport、测试独立增长时再拆。

当前 MCP 命令：

```bash
my-notion mcp serve --transport stdio
```

STDIO MCP 鉴权：

- 从 `MY_NOTION_API_TOKEN` 或 CLI 本地配置读取 PAT。
- 不通过 MCP 自身“拿到登录态”。
- MCP server 对外暴露 tools：
  - `my_notion_docs_create`
  - `my_notion_docs_fetch`
  - `my_notion_docs_update`
  - `my_notion_docs_search`

已完成状态：

- `my-notion mcp serve --transport stdio` 已落地在 `packages/my-notion-cli/src/mcp/`。
- `my-notion-mcp` skill 已落地在 `packages/my-notion-skills/my-notion-mcp/SKILL.md`。
- MCP E2E 已通过 `pnpm e2e:mcp` 覆盖 `initialize`、`tools/list`、`tools/call` 和真实文档链路。

HTTP MCP 鉴权：

- 作为后续增强。
- 需要 OAuth 2.1 / Protected Resource Metadata / Authorization Server Metadata。
- 可以复用 PAT 作为非标准 Bearer token 的内部模式，但若要兼容主流 MCP client，建议实现标准 OAuth。

结论：

- MCP 可以提升 Agent 集成体验。
- MCP 不能替代鉴权；它需要消费或承载鉴权。
- 对当前项目，API Token + CLI 是更小、更稳、更符合 MVP 的地基。

### 7. README 与 package scripts

路径：

- 根目录 `package.json`
- `packages/my-notion-cli/package.json`
- `packages/my-notion-skills/package.json`

当前根目录相关脚本：

```json
{
  "e2e:cli": "node scripts/e2e-my-notion-cli.mjs",
  "e2e:mcp": "node scripts/e2e-my-notion-mcp.mjs",
  "sync:skills": "node scripts/sync-my-notion-skills.mjs"
}
```

当前 package 内脚本：

```bash
pnpm --filter @notion/my-notion-cli typecheck
pnpm --filter @notion/my-notion-cli build
pnpm --filter @notion/my-notion-cli test
pnpm --filter @notion/my-notion-skills lint
```

根 README 可在后续加入 CLI/MCP 快速开始；当前重点以架构文档、progress 记录和 skills 引用为准。

## Phased Roadmap

> 状态更新：Phase 1-4 已完成；Phase 5 进入候选增强与工程加固阶段。

### Phase 1：机器 API 与 Token 地基（已完成）

目标：

- 建立 API Token 表。
- 建立 token 创建、撤销、校验流程。
- 建立文档 CRUD HTTP Actions。

验收：

- 使用 Bearer token 可创建、读取、更新、搜索当前用户文档。
- 错误码覆盖 401、403、404、422、429、500。
- 不允许客户端传入 `userId` 冒充其他用户。

### Phase 2：CLI MVP（已完成）

目标：

- 已新增 `packages/my-notion-cli`。
- 已实现 `auth status/login/logout`、`tokens revoke-current`、`docs create/fetch/update/search/list`。
- 默认 JSON 输出，支持 pretty/table/ndjson/markdown。

验收：

- Agent 可通过 CLI 从 Markdown 文件创建文档。
- CLI 能稳定解析错误并返回非 0 exit code。
- CLI 配置不把 token 打印到日志。

### Phase 3：Skills MVP（已完成）

目标：

- 已新增 `packages/my-notion-skills`。
- 已编写 `my-notion-shared`、`my-notion-docs` 和 `my-notion-mcp`。
- 明确 Agent 调用规范、dry-run、Markdown 文件优先策略。

验收：

- Agent 能根据 skill 文档独立完成“生成一篇文档并写入 My-Notion”。
- skill 中包含安装、认证、创建、读取、更新、搜索示例。

### Phase 4：MCP Adapter（已完成 STDIO MVP）

目标：

- 在 `packages/my-notion-cli` 内实现 `my-notion mcp serve --transport stdio`。
- 复用 CLI 的 HTTP client 和 token store。
- 暴露 docs tools。

验收：

- Cursor/Claude Desktop 等 MCP client 可调用文档工具。
- MCP tool 输出包含 `structuredContent` 和文本 fallback。
- 写操作支持 client 侧确认或 dry-run。

### Phase 5：增强能力

候选：

- `docs import` / `docs export`。
- `kb search` / `kb sync`。
- `agent ask`：调用 My-Notion Agent 并支持 NDJSON streaming。
- OAuth 2.1 HTTP MCP。
- Token scope UI（已完成基础版）和审计日志。

## Assumptions & Decisions

- 决策：首版技术方案已从架构蓝图推进到 Phase 1-4 MVP 落地，后续进入加固与增强阶段。
- 决策：CLI 和 Skills 放入 `packages`，分别命名为 `packages/my-notion-cli` 与 `packages/my-notion-skills`。
- 决策：首版 CLI 鉴权采用 API Token，而不是 Clerk OAuth。
- 决策：首版文档内容格式 Markdown 优先。
- 决策：MCP 不替代鉴权，作为后续 Agent 适配层。
- 决策：机器 API 不信任客户端传入的 `userId`，必须从 token 解析。
- 假设：生产环境可暴露 Convex HTTP Actions 的 `.site` URL，或由 Web 域名反向代理。
- 决策：当前已采用 Markdown 到 BlockNote 的简化转换，复杂 block fidelity 后续迭代。

## Risks

- Markdown 与 BlockNote JSON 的转换可能影响 Web 编辑器展示效果，需要明确兼容策略。
- API Token 是长期凭据，当前已支持撤销、过期、scope、lastUsedAt 和安全展示；后续可补审计日志。
- Convex HTTP Actions 的路由、CORS、部署 URL 需要与当前 Vercel/Convex 生产环境协调。
- MCP HTTP OAuth 完整实现复杂，不应阻塞 CLI MVP。
- Skills 文档如果写得过宽，会导致 Agent 调用危险命令；必须优先约束 dry-run、scope 和输出解析。

## Verification Steps

规划验证：

- 检查 `packages/my-notion-cli` TypeScript：`pnpm --filter @notion/my-notion-cli typecheck`。
- 检查 CLI 单测：`pnpm --filter @notion/my-notion-cli test`。
- 检查 CLI E2E：`pnpm e2e:cli`。
- 检查 MCP E2E：`pnpm e2e:mcp`。
- 同步 Skills：`pnpm sync:skills`。
- 检查 Convex/Web 类型：`pnpm --filter @notion/web typecheck`。
- 检查 Web 构建：`pnpm --filter @notion/web build`。
- 检查 Web lint：`pnpm --filter @notion/web lint`。

接口验收：

- 无 token 请求 `/cli/v1/documents` 返回 401。
- 无 `docs:write` scope 创建文档返回 403。
- 使用有效 token 创建 Markdown 文档返回 document id 和 URL。
- 使用另一个用户 token 读取该文档返回 404 或 403。
- revoke token 后再次调用返回 401。

CLI 验收：

- `my-notion auth status` 能显示 API URL、token 前缀、scope，不泄漏完整 token。
- `my-notion docs create --content-file draft.md --format json` 返回稳定 JSON。
- `my-notion docs fetch --id xxx --format markdown` 可被 Agent 直接读取。
- `my-notion docs update --mode append` 可追加写入；MCP `my_notion_docs_update` 默认 `dryRun: true` 不产生写入。

Skills 验收：

- Agent 读取 `my-notion-docs` skill 后，可以正确选择 `docs create/fetch/update/search`。
- skill 明确要求长内容使用 `--content-file`。
- skill 明确禁止在聊天或日志中输出完整 token。

