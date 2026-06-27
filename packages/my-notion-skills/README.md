# My-Notion Skills

My-Notion Skills 是给 AI Agent 的操作手册，不是业务代码。它们约束 Agent 如何安装、认证和调用 `my-notion` CLI / `my-notion-mcp`，目标是用最少用户可见输出完成安全的文档读写。

[Skills](#skills) · [安装](#安装) · [Agent 流程](#agent-流程) · [输出规则](#输出规则) · [同步](#sync) · [安全](#safety)

## Skills

| Skill | 触发场景 | 核心能力 |
| --- | --- | --- |
| `my-notion-shared` | 使用 CLI、登录、配置、排查认证问题 | 浏览器授权、prod/local 登录态隔离、输出格式、Token 安全规则 |
| `my-notion-docs` | 创建、读取、搜索、更新、导入、导出、归档文档 | 通过 CLI 操作文档，长内容使用临时 Markdown 文件 |
| `my-notion-mcp` | 需要 MCP tool 而不是直接 shell 命令 | 启动独立 MCP STDIO server，暴露 readme、搜索、读取、创建和更新工具 |

## 安装

发布后的推荐安装方式：

```bash
npm install -g @mynotion/cli@latest
npx skills add @mynotion/cli -y -g
my-notion config init --check --format json
my-notion update --check --format json
```

Skills 随 `@mynotion/cli` npm 包一起发布，不单独发布 `@mynotion/skills`。`my-notion install --check --format json` 会输出 CLI 与 Skills 安装提示。

## Agent 流程

```bash
# 1. 先检查环境、配置和登录态
my-notion config init --check --format json
my-notion update --check --format json

# 2. 未登录时获取浏览器授权链接
my-notion auth login --no-open

# 3. 授权完成后重试原任务
my-notion docs search --query "关键词" --format json
my-notion docs create --title "标题" --content-file /tmp/my-notion-doc.md --format json
```

Agent 处理登录缺失时：

- 提取 CLI 输出中的授权 URL。
- 用 Markdown 可点击链接发给用户，例如 `[打开 My-Notion CLI 授权](https://...)`。
- 同时展示用户码，提醒用户核对页面验证码。
- 用户授权后重试原命令。
- 不要求用户复制或粘贴完整 `mnt_` Token。

## 输出规则

- 需要升级 CLI 时，先运行 `my-notion update --check --format json`，用户确认后再执行输出中的 `commands.updateCli` 和 `commands.updateSkills`。
- 用户可见回复只保留最终结果，例如文档标题、文档 ID、是否已创建/更新/归档。
- 调用 CLI 时默认使用 `--format json`；读取正文时使用 `--format markdown`。
- 长内容先写入临时 Markdown 文件，再用 `--content-file`。
- Agent 默认只读写 Markdown；系统负责 Markdown <-> BlockNote blocks 双向转换。
- `docs fetch/export` 返回的 Markdown 是从内部 BlockNote JSON 序列化得到的 Agent 可编辑视图。
- 不要让 Agent 直接生成或解析 BlockNote JSON。
- 更新已有文档默认用 `docs update --mode append`。
- 只有用户明确要求替换全文时，才使用 `--mode overwrite`。
- 不默认输出 `auth status` JSON、配置路径、token prefix、profile 细节或完整 CLI 原始响应。

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

- 不在 Skill 文档、日志、聊天或代码仓库中写入完整 PAT。
- CLI 默认连接 `https://moonlit-ptarmigan-478.convex.site`；连接其他部署时再传 `--local`、`--api-url` 或设置 `MY_NOTION_API_URL`。
- 线上登录态使用 `~/.local/share/my-notion/config.json`；本地登录态使用 `~/.local/share/my-notion/config.local.json`。
- 授权 URL 只能包含 `user_code`；不要输出或保存 `device_code`。
- MCP 写工具默认 `dryRun: true`，只有用户明确批准后才执行真实写入。
- 如怀疑凭据泄漏，先执行 `my-notion tokens revoke-current --format json`，再重新登录。
