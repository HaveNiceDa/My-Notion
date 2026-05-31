# My-Notion Skills

My-Notion 的 Agent Skills 源文件目录。它们不是业务代码，而是给 AI Agent 的操作手册：告诉 Agent 如何以最少输出、安全边界清晰的方式调用 `my-notion` CLI 和 MCP STDIO server。

[Skills](#skills) · [安装](#安装) · [Agent 输出规则](#agent-输出规则) · [同步](#sync) · [安全](#safety)

## Skills

| Skill | 触发场景 | 核心能力 |
| --- | --- | --- |
| `my-notion-shared` | 使用 CLI、登录、配置、排查认证问题 | 浏览器授权、prod/local 登录态隔离、输出格式、Token 安全规则 |
| `my-notion-docs` | 创建、读取、搜索、更新、导入、导出或归档文档 | 通过 CLI 操作文档，长内容使用临时 Markdown 文件 |
| `my-notion-mcp` | 需要 MCP tool 而不是 shell 命令 | 启动 MCP STDIO server，暴露搜索、读取、创建和更新工具 |

## 安装

发布后的推荐安装方式：

```bash
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g
```

当前首版策略是 Skills 随 `@mynotion/cli` npm 包一起发布，不单独发布 `@mynotion/skills`。如果 `skills add` 工具不支持 npm package source，再切换到 GitHub URL 或 `my-notion install --skills` 方案。

## Agent 输出规则

- 授权 URL 必须以 Markdown 可点击链接输出，例如 `[打开 My-Notion CLI 授权](https://...)`。
- 用户可见回复只保留必要信息，例如操作结果、文档标题、文档 ID。
- 不默认输出 `auth status` JSON、配置路径、token prefix、profile 细节或完整 CLI 原始响应。
- 登录缺失时，Agent 应运行 `auth login --no-open`，发送授权链接和用户码，授权后重试原任务。
- 默认使用线上 `prod` 登录态；本地调试必须显式使用 `--local`。

## Sync

修改本目录后运行：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

同步目标：

```text
.trae/skills/
packages/my-notion-cli/skills/
```

## Safety

- 不在 Skill 文档中写入完整 PAT。
- CLI 默认连接 `https://laudable-albatross-174.convex.site`；连接其他部署时再传 `--api-url` 或设置 `MY_NOTION_API_URL`。
- 线上登录态使用 `~/.local/share/my-notion/config.json`；本地登录态使用 `~/.local/share/my-notion/config.local.json`。
- 写文档优先使用临时 Markdown 文件和 `--content-file`。
- MCP 写工具默认 `dryRun: true`，只有用户明确批准后才执行真实写入。
- CLI 写命令必须使用 `--format json` 便于 Agent 解析结果。
