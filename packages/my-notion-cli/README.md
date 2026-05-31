# My-Notion CLI

面向人类用户和 AI Agent 的 My-Notion 命令行工具。通过浏览器 Device Flow 授权后，`my-notion` 可以安全地创建、读取、搜索、更新、导入、导出和归档 My-Notion 文档，也可以启动 MCP STDIO server，把同一批能力暴露给支持 MCP 的 Agent。

[快速开始](#快速开始) · [Agent 模式](#quick-start-ai-agent) · [认证](#认证与配置) · [命令](#命令体系) · [MCP](#mcp-stdio) · [安全](#安全边界) · [验证](#开发与验证)

## Why My-Notion CLI?

- **Agent-Native**：默认 JSON 输出、Markdown 文件输入、短命令和稳定错误信息，方便 Agent 调用和解析。
- **浏览器授权**：首选 `auth login` Device Flow，不要求用户在聊天中粘贴完整 `mnt_` Token。
- **线上优先**：默认连接线上 `prod`，本地调试使用 `--local` 独立登录态，不污染线上配置。
- **文档闭环**：覆盖 `create`、`fetch`、`search`、`list`、`update`、`archive`、`import`、`export`。
- **MCP 适配**：`mcp serve --transport stdio` 复用 CLI 登录态，提供搜索、读取、创建和更新工具。
- **安全可控**：写操作显式命令边界；MCP 写工具默认 `dryRun: true`；服务端按 PAT scope、rate limit 和 audit log 控制访问。

## 能力概览

| 模块 | 能力 |
| --- | --- |
| `auth` | 浏览器登录、状态检查、退出本机登录态 |
| `docs` | 创建、读取、搜索、列出、更新、归档、导入和导出文档 |
| `tokens` | 撤销当前 CLI PAT，使本机凭据服务端失效 |
| `mcp` | 启动 MCP STDIO server，给 Agent 暴露文档工具 |
| `skills` | `my-notion-shared`、`my-notion-docs`、`my-notion-mcp` 指导 Agent 正确调用 CLI/MCP |

## 安装与运行

### Requirements

- Node.js 20+
- pnpm 9+
- 一个可登录的 My-Notion Web 账号

### Monorepo 开发运行

```bash
pnpm --filter @mynotion/cli dev <command>
```

### 构建后运行

```bash
pnpm --filter @mynotion/cli build
node packages/my-notion-cli/dist/index.js <command>
```

### 发布后运行目标

```bash
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g
npx @mynotion/cli@beta <command>
```

## 快速开始

### Quick Start Human Users

```bash
# 1. 安装 beta CLI 和 Agent Skills
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g

# 2. 浏览器授权登录
my-notion auth login

# 3. 搜索文档
my-notion docs search \
  --query "项目周报" \
  --format json

# 4. 创建文档
my-notion docs create \
  --title "项目周报" \
  --content-file ./weekly-report.md \
  --format json
```

### Quick Start AI Agent

> Agent 只需要把授权链接发给用户，不要要求用户粘贴完整 Token。

```bash
# 1. 安装 CLI 和 Skills
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g

# 2. 检查登录态；如果失败再进入第 3 步
my-notion auth status --format json

# 3. 需要登录时后台运行，提取 CLI 输出的授权链接
my-notion auth login --no-open
```

Agent 给用户的授权提示应保持简洁，并使用 Markdown 可点击链接：

```text
请打开 [My-Notion CLI 授权](https://notion-j9zj.vercel.app/cli/auth?user_code=XXXX-XXXX)，确认页面验证码为 XXXX-XXXX。
```

授权完成后重试原命令，只向用户报告最终结果，例如：

```text
已创建文档：测试1
文档 ID：j57...
```

## 认证与配置

### 默认线上登录

默认 profile 是 `prod`：

```text
Web URL: https://notion-j9zj.vercel.app
API URL: https://laudable-albatross-174.convex.site
Config:  ~/.local/share/my-notion/config.json
```

```bash
my-notion auth login
my-notion auth status --format json
my-notion auth logout
```

### 本地调试登录

本地调试必须显式使用 `--local`，登录态单独存放，不会影响线上默认入口：

```text
Config: ~/.local/share/my-notion/config.local.json
```

```bash
my-notion auth login \
  --local \
  --web-url http://localhost:3000 \
  --api-url "https://<dev-deployment>.convex.site"
```

### 配置优先级

1. 命令行参数：`--local`、`--profile`、`--web-url`、`--api-url`、`--token`
2. 环境变量：`MY_NOTION_PROFILE`、`MY_NOTION_WEB_URL`、`MY_NOTION_API_URL`、`MY_NOTION_API_TOKEN`
3. 本地配置：线上 `config.json`，本地 `config.local.json`
4. 默认线上配置

`MY_NOTION_API_TOKEN` 和 `--token` 仅作为兼容或 CI 调试入口。Agent 工作流应优先使用浏览器授权。

## 命令体系

### 1. Auth

```bash
my-notion auth login [--no-open] [--local] [--web-url <url>] [--api-url <url>]
my-notion auth status [--format json]
my-notion auth logout [--local]
```

### 2. Docs

```bash
my-notion docs search --query "关键词" --limit 10 --format json
my-notion docs list --limit 20 --format json
my-notion docs create --title "标题" --content-file ./draft.md --format json
my-notion docs fetch --id <documentId> --format markdown
my-notion docs update --id <documentId> --mode append --content-file ./append.md --format json
my-notion docs export --id <documentId> --output ./document.md
my-notion docs import --title "导入文档" --file ./document.md --format json
my-notion docs archive --id <documentId> --format json
```

### 3. Tokens

```bash
my-notion tokens revoke-current --format json
```

`auth logout` 只清除本机保存的 Token；`tokens revoke-current` 会让当前 PAT 在服务端失效。

## MCP STDIO

启动 MCP server：

```bash
my-notion mcp serve --transport stdio
```

当前暴露工具：

| Tool | 说明 | 默认安全策略 |
| --- | --- | --- |
| `my_notion_docs_search` | 搜索文档 | 只读 |
| `my_notion_docs_fetch` | 读取文档 | 只读 |
| `my_notion_docs_create` | 创建文档 | `dryRun: true` |
| `my_notion_docs_update` | 更新文档 | `dryRun: true`，默认 append |

## Agent Skills

安装已发布的 Skills：

```bash
npx skills add @mynotion/cli -y -g
```

| Skill | 用途 |
| --- | --- |
| `my-notion-shared` | CLI 安装、认证、配置、输出格式和安全规则 |
| `my-notion-docs` | 创建、读取、搜索、更新、导入、导出和归档文档 |
| `my-notion-mcp` | 启动 MCP STDIO server 并使用 MCP tools |

修改 Skills 后必须同步：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

## Advanced Usage

### 输出格式

```bash
--format json      # 紧凑 JSON，Agent 默认推荐
--format pretty    # 格式化 JSON，适合人类查看
--format table     # 表格输出
--format ndjson    # 一行一个 JSON，适合管道处理
--format markdown  # 仅输出文档 Markdown 正文
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

## 安全边界

- 不要把完整 `mnt_` PAT 写进聊天、日志、文档或代码仓库。
- 不要把 `device_code` 写进聊天或公开日志；授权 URL 只应包含 `user_code`。
- Agent 给用户展示授权信息时，只展示可点击授权链接和用户码。
- Agent 默认不要回显 `auth status`、配置路径、token prefix、profile 细节或原始 CLI JSON。
- 写入已有文档时优先使用 `--mode append`；只有用户明确要求替换全文时才使用 `--mode overwrite`。
- MCP 写工具保持 `dryRun: true`，除非用户明确批准真实写入。

## 开发与验证

```bash
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
```

## 参考

- 使用说明：[`docs/usage.md`](./docs/usage.md)
- 发布清单：[`../../docs/my-notion-cli-release-checklist.md`](../../docs/my-notion-cli-release-checklist.md)
- Skills 源目录：[`../my-notion-skills`](../my-notion-skills)
