# My-Notion CLI 与 Skills 技术方案

## Summary

本方案面向 My-Notion 的 Agent 生态扩展，新增两个 monorepo package：

- `packages/cli`：提供 `my-notion` 命令行工具，给人类用户和外部 Agent 提供稳定、机器友好的文档操作入口。
- `packages/skills`：提供 Agent Skills 文档与引用资料，让 Agent 知道何时、如何、安全地调用 `my-notion` CLI。

首版定位为架构蓝图，不立即追求飞书 `lark-cli` 的完整覆盖面。MVP 聚焦文档 CRUD：

- 创建文档：Agent 可把 Markdown 内容生成到 My-Notion。
- 读取文档：Agent 可根据文档 ID 获取标题和内容。
- 更新文档：Agent 可覆盖、追加或局部替换 Markdown 内容。
- 搜索/列出文档：Agent 可查找用户已有文档。
- 鉴权：采用 My-Notion Personal Access Token（PAT / API Token），CLI 本地保存 token，服务端按 token 映射到 `userId`。

MCP 不建议作为“替代鉴权”的首版核心。MCP HTTP transport 本身仍然需要 OAuth 2.1 / Bearer Token；MCP STDIO transport 通常从环境变量或本地凭据读取认证信息。因此 MCP 更适合定位为 CLI/REST 能力之上的 Agent 适配层，而不是绕过登录鉴权的机制。

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
- 当前没有面向 CLI/Agent 的 Personal Access Token 表，也没有稳定的机器 API。

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
packages/cli
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
packages/skills
  -> 告诉 Agent 如何调用 my-notion CLI

MCP adapter（后续）
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

### 1. 新增 `packages/cli`

路径：

- `packages/cli/package.json`
- `packages/cli/tsconfig.json`
- `packages/cli/src/index.ts`
- `packages/cli/src/commands/auth.ts`
- `packages/cli/src/commands/docs.ts`
- `packages/cli/src/client/http-client.ts`
- `packages/cli/src/config/store.ts`
- `packages/cli/src/format/output.ts`
- `packages/cli/src/types.ts`

职责：

- 提供 npm binary：`my-notion`。
- 默认输出 JSON，支持 `--format json|pretty|table|ndjson`。
- 所有命令支持 `--api-url`，默认从配置或 `MY_NOTION_API_URL` 读取。
- 所有需要身份的命令从配置、环境变量 `MY_NOTION_API_TOKEN` 或 `--token` 读取 PAT。
- 有副作用命令支持 `--dry-run`。

建议依赖：

- `commander` 或 `cac`：命令解析。
- `zod`：请求/响应校验。
- `undici` 或 Node 18+ 原生 `fetch`：HTTP 调用。
- `conf` 或自研 JSON 文件：本地配置存储。

推荐首版命令：

```bash
my-notion auth login --api-url https://<convex-site-or-web-domain> --token mnt_xxx
my-notion auth status
my-notion docs create --title "标题" --content-file ./draft.md --format json
my-notion docs fetch --id <documentId> --format markdown
my-notion docs update --id <documentId> --content-file ./draft.md --mode overwrite
my-notion docs update --id <documentId> --content "补充内容" --mode append
my-notion docs search --query "关键词" --limit 10
my-notion docs list --limit 20
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

### 2. 新增 `packages/skills`

路径：

- `packages/skills/package.json`
- `packages/skills/README.md`
- `packages/skills/my-notion-shared/SKILL.md`
- `packages/skills/my-notion-docs/SKILL.md`
- `packages/skills/my-notion-docs/references/docs-create.md`
- `packages/skills/my-notion-docs/references/docs-fetch.md`
- `packages/skills/my-notion-docs/references/docs-update.md`
- `packages/skills/my-notion-docs/references/docs-search.md`
- `packages/skills/my-notion-mcp/SKILL.md`（后续）

职责：

- `my-notion-shared`：安装、配置、认证、安全规则、输出格式、dry-run 规则。
- `my-notion-docs`：文档 CRUD 的 Agent 使用指南。
- `my-notion-mcp`：后续说明何时使用 MCP server，何时使用 CLI。

`my-notion-docs` skill 的核心规则：

- 创建文档默认使用 Markdown。
- Agent 生成长文档时优先写入临时 `.md` 文件，再用 `--content-file`，避免 shell quoting 失败。
- 所有写操作先使用 `--dry-run` 预览，除非用户明确授权直接执行。
- 读取/搜索命令优先使用 `--format json`，便于 Agent 解析。
- 不在命令参数中暴露 token；优先使用本地配置或环境变量。

### 3. 新增 API Token 数据模型

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

### 4. 新增机器 API / Convex HTTP Actions

路径：

- `apps/web/convex/http.ts`
- `packages/convex/cli/auth.ts`
- `packages/convex/cli/documents.ts`
- `packages/convex/cli/types.ts`
- `packages/convex/cli/index.ts`

建议 endpoints：

```text
GET  /cli/v1/auth/status
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

- 首版 API 接收 `contentFormat: "markdown"`。
- 服务端先把 Markdown 作为兼容内容存储，或在后续引入 Markdown -> BlockNote blocks 转换。
- 若当前编辑器页面仍期望 BlockNote JSON，MVP 需要提供兼容策略：
  - 方案 A：服务端保存 Markdown 包装后的 BlockNote paragraph blocks。
  - 方案 B：新增 `sourceFormat` 字段记录 Markdown，编辑器加载时做转换。
  - 推荐首版采用方案 A，避免修改文档 schema。

### 5. Token 创建与管理入口

首版建议：

- Web 设置页生成 PAT，用户复制到 CLI。
- CLI 使用：

```bash
my-notion auth login --api-url https://xxx --token mnt_xxx
```

需要新增的 Web/API 能力：

- `POST /api/cli/tokens`：在 Clerk 登录态下创建 token。
- `GET /api/cli/tokens`：列出当前用户 token 元信息。
- `DELETE /api/cli/tokens/:id`：撤销 token。

注意：

- 这些 token 管理 API 可以继续使用 Next.js API Route + Clerk `auth()`。
- 真正的 CLI 文档 API 不依赖 Clerk，而依赖 PAT。

### 6. MCP 适配设计

首版不把 MCP 作为必需实现项，但方案预留能力：

路径选择：

- 简单阶段：`packages/cli/src/mcp/`，作为 CLI package 内的 `my-notion mcp serve` 子命令。
- 复杂阶段：拆出 `packages/mcp`，当 MCP server 生命周期、transport、测试独立增长时再拆。

推荐首版 MCP 命令：

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
- `packages/cli/package.json`
- `packages/skills/package.json`

建议新增脚本：

```json
{
  "cli:dev": "pnpm --filter @notion/cli dev",
  "cli:typecheck": "pnpm --filter @notion/cli typecheck",
  "cli:test": "pnpm --filter @notion/cli test",
  "skills:lint": "pnpm --filter @notion/skills lint"
}
```

不建议首版修改根 README 的大段内容。若实现完成，再在 README Roadmap 或快速开始中加入 CLI 简介。

## Phased Roadmap

### Phase 1：机器 API 与 Token 地基

目标：

- 建立 API Token 表。
- 建立 token 创建、撤销、校验流程。
- 建立文档 CRUD HTTP Actions。

验收：

- 使用 Bearer token 可创建、读取、更新、搜索当前用户文档。
- 错误码覆盖 401、403、404、422、429、500。
- 不允许客户端传入 `userId` 冒充其他用户。

### Phase 2：CLI MVP

目标：

- 新增 `packages/cli`。
- 实现 `auth status/login` 与 `docs create/fetch/update/search/list`。
- 默认 JSON 输出，支持 pretty/table。

验收：

- Agent 可通过 CLI 从 Markdown 文件创建文档。
- CLI 能稳定解析错误并返回非 0 exit code。
- CLI 配置不把 token 打印到日志。

### Phase 3：Skills MVP

目标：

- 新增 `packages/skills`。
- 编写 `my-notion-shared` 和 `my-notion-docs`。
- 明确 Agent 调用规范、dry-run、Markdown 文件优先策略。

验收：

- Agent 能根据 skill 文档独立完成“生成一篇文档并写入 My-Notion”。
- skill 中包含安装、认证、创建、读取、更新、搜索示例。

### Phase 4：MCP Adapter

目标：

- 在 `packages/cli` 内实现 `my-notion mcp serve --transport stdio`。
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
- Token scope UI 和审计日志。

## Assumptions & Decisions

- 决策：首版技术方案聚焦架构蓝图，而非立即实现全部代码。
- 决策：CLI 和 Skills 放入 `packages`，分别命名为 `packages/cli` 与 `packages/skills`。
- 决策：首版 CLI 鉴权采用 API Token，而不是 Clerk OAuth。
- 决策：首版文档内容格式 Markdown 优先。
- 决策：MCP 不替代鉴权，作为后续 Agent 适配层。
- 决策：机器 API 不信任客户端传入的 `userId`，必须从 token 解析。
- 假设：生产环境可暴露 Convex HTTP Actions 的 `.site` URL，或由 Web 域名反向代理。
- 假设：首版可接受 Markdown 到 BlockNote 的简化转换，复杂 block fidelity 后续迭代。

## Risks

- Markdown 与 BlockNote JSON 的转换可能影响 Web 编辑器展示效果，需要明确兼容策略。
- API Token 是长期凭据，必须支持撤销、过期、scope、lastUsedAt 和安全展示。
- Convex HTTP Actions 的路由、CORS、部署 URL 需要与当前 Vercel/Convex 生产环境协调。
- MCP HTTP OAuth 完整实现复杂，不应阻塞 CLI MVP。
- Skills 文档如果写得过宽，会导致 Agent 调用危险命令；必须优先约束 dry-run、scope 和输出解析。

## Verification Steps

规划验证：

- 检查 `packages/cli` TypeScript：`pnpm --filter @notion/cli typecheck`。
- 检查 CLI 单测：`pnpm --filter @notion/cli test`。
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
- `my-notion docs update --mode append --dry-run` 不产生写入。

Skills 验收：

- Agent 读取 `my-notion-docs` skill 后，可以正确选择 `docs create/fetch/update/search`。
- skill 明确要求长内容使用 `--content-file`。
- skill 明确禁止在聊天或日志中输出完整 token。

