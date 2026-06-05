# My-Notion CLI

面向人类用户和 AI Agent 的 My-Notion 命令行工具。`my-notion` 通过浏览器 Device Flow 授权访问 My-Notion Machine API，支持文档创建、读取、搜索、更新、导入、导出、归档，并可通过 MCP STDIO 将同一批能力暴露给支持 MCP 的 Agent。

[安装](#安装与快速开始) · [Agent Quick Start](#quick-start-ai-agent) · [Skills](#agent-skills) · [认证](#认证与配置) · [命令](#命令体系) · [MCP](#mcp-stdio) · [安全](#安全边界) · [开发](#开发与验证)

## Why My-Notion CLI?

- **Agent-Native**：默认 JSON 输出、稳定错误信息、Markdown 读写契约，便于 Agent 可靠调用。
- **浏览器授权**：使用 Device Flow 登录，不要求用户在聊天中粘贴完整 `mnt_` Token。
- **线上优先**：默认连接线上 `prod`，本地调试必须显式 `--local`，登录态互不污染。
- **文档闭环**：覆盖 `create`、`fetch`、`search`、`list`、`update`、`archive`、`import`、`export`。
- **Skills + MCP**：随 npm 包发布 Agent Skills，也可启动 `mcp serve --transport stdio` 接入 MCP Client。
- **安全可控**：CLI 写入必须显式命令；MCP 写工具默认 `dryRun: true`；服务端有 scope、审计和限流。

## 能力概览

| 模块 | 能力 |
| --- | --- |
| `config` | 初始化/检查 CLI 环境、profile、登录态、Skills 和 MCP 下一步命令 |
| `auth` | 浏览器 Device Flow 登录、状态检查、清除本机登录态 |
| `docs` | 创建、读取、搜索、列出、更新、归档、导入和导出文档 |
| `whiteboards` | 通过 `mwb-dsl-v1` DSL 创建、读取、更新、导出和归档 Excalidraw 画板 |
| `tokens` | 撤销当前 CLI PAT，使本机凭据在服务端失效 |
| `mcp` | 启动 MCP STDIO server，给 MCP Client 暴露文档工具 |
| `install` | 输出 npm、Skills 和 Agent 安装检查信息 |
| `update` | 输出 CLI/Skills 更新指引，并可检查 npm dist-tag 是否有新版本 |
| `skills` | `my-notion-shared`、`my-notion-docs`、`my-notion-mcp`，指导 Agent 正确调用 CLI/MCP |

## 安装与快速开始

### Requirements

- Node.js 20+
- 一个可登录的 My-Notion Web 账号
- monorepo 开发时需要 pnpm 9+

### Quick Start Human Users

```bash
# 1. 安装 CLI 和 Agent Skills
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g

# 2. 初始化并登录
my-notion config init
my-notion auth login

# 3. 检查状态
my-notion config init --check --format json
my-notion update --check --format json

# 4. 创建或搜索文档
my-notion docs create --title "项目周报" --content-file ./weekly-report.md --format json
my-notion docs search --query "项目周报" --limit 10 --format json
```

### Quick Start AI Agent

> Agent 只需要把授权链接发给用户，不要要求用户粘贴完整 Token。

```bash
# 1. 检查 CLI、配置、登录态和下一步动作
my-notion config init --check --format json

# 2. 未登录或 Token 失效时，后台运行并提取授权 URL
my-notion auth login --no-open

# 3. 授权完成后重试原任务
my-notion docs create --title "Agent Doc" --content-file /tmp/my-notion-doc.md --format json
```

Agent 给用户的授权提示必须使用 Markdown 可点击链接：

```text
请打开 [My-Notion CLI 授权](https://notion-j9zj.vercel.app/cli/auth?user_code=XXXX-XXXX)，确认页面验证码为 XXXX-XXXX。
```

授权完成后，只报告最终结果，例如：

```text
已创建文档：Agent Doc
文档 ID：j57...
```

## Agent Skills

Skills 随 `@mynotion/cli` npm 包发布，不单独发布 `@mynotion/skills`。安装命令：

```bash
npx skills add @mynotion/cli -y -g
```

| Skill | 触发场景 | 核心规则 |
| --- | --- | --- |
| `my-notion-shared` | 使用 CLI、登录、配置、排查认证问题 | 浏览器授权、prod/local 隔离、输出格式、Token 安全 |
| `my-notion-docs` | 创建、读取、搜索、更新、导入、导出、归档文档 | 长内容写临时 Markdown 文件，写命令使用 `--format json` |
| `my-notion-mcp` | 需要 MCP tool 而不是直接 shell 命令 | 启动 STDIO server，写工具保持 `dryRun: true` |

Agent 调用规则：

- 版本检查：先运行 `my-notion update --check --format json`；如需更新，先向用户确认，再运行输出中的 `updateCli` 和 `updateSkills` 命令。
- 登录缺失：运行 `my-notion auth login --no-open`，只把授权链接和用户码发给用户。
- 文档写入：优先生成 Markdown 文件，再用 `--content-file` 创建或追加。
- 文档读取：`docs fetch/export` 返回从 BlockNote JSON 序列化得到的 `contentMarkdown`；Agent 应基于 Markdown 二次编辑，不要解析或生成 BlockNote JSON。
- 更新文档：默认 `docs update --mode append`；只有用户明确要求替换全文才用 `overwrite`。
- 用户可见回复：只保留操作结果、文档标题、文档 ID 或必要错误摘要。
- 不默认展示：完整 CLI JSON、配置路径、token prefix、profile 细节、完整 PAT。

修改 Skills 源文件后必须同步：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

同步目标：`.trae/skills/` 和 `packages/my-notion-cli/skills/`。

## 认证与配置

### 默认线上配置

默认 profile 是 `prod`：

```text
Web URL: https://notion-j9zj.vercel.app
API URL: https://moonlit-ptarmigan-478.convex.site
Config:  ~/.local/share/my-notion/config.json
```

本地调试必须显式使用 `--local`，登录态保存到独立文件：

```text
Config: ~/.local/share/my-notion/config.local.json
```

### 初始化

`config init` 是首屏配置入口。它会检查 Node 版本、profile、API/Web URL、登录态、Skills 安装提示和 MCP 启动命令；写入的只是非敏感 profile 元信息，不输出完整 Token。

```bash
my-notion config init
my-notion config init --check --format json
my-notion config init --dry-run --format json
my-notion config init --local --web-url http://localhost:3000 --api-url "https://<dev-deployment>.convex.site"
```

### 登录

```bash
# 人类用户：打开浏览器完成授权
my-notion auth login

# Agent：输出授权 URL，由 Agent 转发给用户
my-notion auth login --no-open

# 本地调试：必须显式 --local
my-notion auth login \
  --local \
  --web-url http://localhost:3000 \
  --api-url "https://<dev-deployment>.convex.site"
```

### 状态与退出

```bash
my-notion auth status --format json
my-notion auth logout
my-notion tokens revoke-current --format json
```

`auth logout` 只清除本机保存的 Token；`tokens revoke-current` 会让当前 PAT 在服务端失效。

### 配置优先级

1. 命令行参数：`--local`、`--profile`、`--web-url`、`--api-url`、`--token`
2. 环境变量：`MY_NOTION_PROFILE`、`MY_NOTION_WEB_URL`、`MY_NOTION_API_URL`、`MY_NOTION_API_TOKEN`
3. 本地配置：线上 `config.json`，本地 `config.local.json`
4. 默认线上配置

`MY_NOTION_API_TOKEN` 和 `--token` 仅作为兼容或 CI 调试入口。Agent 工作流应优先使用浏览器授权。

## 命令体系

### 1. Config

```bash
my-notion config init [--check] [--dry-run] [--local] [--web-url <url>] [--api-url <url>]
```

### 2. Auth

```bash
my-notion auth login [--no-open] [--local] [--web-url <url>] [--api-url <url>]
my-notion auth status [--format json]
my-notion auth logout [--local]
```

### 3. Docs

```bash
my-notion docs search --query "关键词" --limit 10 --format json
my-notion docs list --limit 20 --format json
my-notion docs create --title "标题" --content-file ./draft.md --format json
my-notion docs fetch --id <documentId> --format markdown
my-notion docs update --id <documentId> --mode append --content-file ./append.md --format json
my-notion docs export --id <documentId> --output ./document.md
my-notion docs import --title "导入文档" --file ./document.md --format json
my-notion whiteboards create --title "架构图" --dsl-file ./board.mwb.yaml --document-id <documentId> --format json
my-notion whiteboards update --id <whiteboardId> --dsl-file ./board.mwb.yaml --format json
my-notion whiteboards fetch --id <whiteboardId> --format json
my-notion whiteboards export --id <whiteboardId> --format json --output ./board.excalidraw
my-notion whiteboards export --id <whiteboardId> --format package --output ./board-package
my-notion docs archive --id <documentId> --format json
```

推荐顺序：先 `search/list` 确认是否已有文档，再 `create/import`；修改已有文档时优先 `append`。
画板完整包导出会写入 `scene.json`、`thumbnail.txt` 和 `whiteboard.svg`，用于备份或跨环境迁移。

### 4. Tokens

```bash
my-notion tokens revoke-current --format json
```

### 5. Install

```bash
my-notion install --check --format json
my-notion install --skills --format json
```

### 6. Update

```bash
my-notion update --format json
my-notion update --check --format json
my-notion update --check --tag latest --format json
```

`update` 不会自动执行 npm 安装。Agent 应读取输出中的 `commands.updateCli`、`commands.updateSkills` 和 `commands.verifyCli`，获得用户确认后再执行更新。

## MCP STDIO

启动 MCP server：

```bash
my-notion mcp serve --transport stdio
```

当前暴露工具：

| Tool | 能力 | 默认安全策略 |
| --- | --- | --- |
| `my_notion_docs_search` | 搜索文档 | 只读 |
| `my_notion_docs_fetch` | 读取文档 | 只读 |
| `my_notion_docs_create` | 创建文档 | `dryRun: true` |
| `my_notion_docs_update` | 更新文档 | `dryRun: true`，默认 append |

MCP 写工具的 dry-run 输出会包含 `confirmationRequired: true`。只有用户明确批准后，Agent 才能把 `dryRun` 改为 `false` 执行真实写入。

文档内容格式契约：

- Agent / CLI / MCP 默认只读写 Markdown。
- 服务端负责 Markdown <-> BlockNote blocks 双向转换。
- `content` 是内部 BlockNote JSON string；`contentMarkdown` 是 Agent 可编辑视图。
- 不要让普通 Agent 直接生成或解析 BlockNote JSON。

真实 MCP Client 验证入口：

```bash
pnpm e2e:mcp:client
```

该脚本使用 `@modelcontextprotocol/sdk` 的 `Client + StdioClientTransport` 启动 `my-notion mcp serve --transport stdio`，覆盖认证失败、工具发现、dry-run 预览、确认后真实创建、读取、追加、搜索、归档清理和测试 PAT 撤销。

最小 SDK Client 示例：

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "my-notion",
  args: ["mcp", "serve", "--transport", "stdio"],
});
const client = new Client({ name: "my-agent", version: "0.1.0" });

await client.connect(transport);
const tools = await client.listTools();
const preview = await client.callTool({
  name: "my_notion_docs_create",
  arguments: {
    title: "MCP Dry Run",
    contentMarkdown: "# MCP Dry Run\n\nPreview only.",
    dryRun: true,
  },
});
await client.close();
```

## Advanced Usage

### 输出格式

```bash
--format json      # 紧凑 JSON，Agent 默认推荐
--format pretty    # 格式化 JSON，适合人类查看
--format table     # 表格输出
--format ndjson    # 一行一个 JSON，适合管道处理
--format markdown  # 文档 Markdown 正文，常用于 docs fetch/export
```

### 推荐写入模式

```bash
# 长内容优先使用临时 Markdown 文件，避免 shell quoting 问题
my-notion docs create \
  --title "长文档" \
  --content-file /tmp/my-notion-doc.md \
  --format json

# 追加比覆盖更安全
my-notion docs update \
  --id <documentId> \
  --mode append \
  --content-file /tmp/append.md \
  --format json
```

### 本地开发运行

```bash
pnpm --filter @mynotion/cli dev <command>
pnpm --filter @mynotion/cli build
node packages/my-notion-cli/dist/index.js <command>
```

## 安全边界

- 不要把完整 `mnt_` PAT 写进聊天、日志、文档或代码仓库。
- 不要把 `device_code` 写进聊天或公开日志；授权 URL 只应包含 `user_code`。
- Agent 给用户展示授权信息时，只展示可点击授权链接和用户码。
- Agent 默认不要回显 `auth status`、配置路径、token prefix、profile 细节或原始 CLI JSON。
- 写入已有文档时优先 `--mode append`；只有用户明确要求替换全文时才使用 `--mode overwrite`。
- MCP 写工具保持 `dryRun: true`，除非用户明确批准真实写入。
- 如怀疑当前凭据泄漏，先执行 `my-notion tokens revoke-current --format json`，再重新登录。

## 开发与验证

```bash
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm e2e:mcp:client
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

## 参考

- 使用说明：[`docs/usage.md`](./docs/usage.md)
- 发布清单：[`../../docs/my-notion-cli-release-checklist.md`](../../docs/my-notion-cli-release-checklist.md)
- 阶段发布记录：[`../../progress/20260527-20260531-consolidated.md`](../../progress/20260527-20260531-consolidated.md)
- Skills 源目录：[`../my-notion-skills`](../my-notion-skills)
