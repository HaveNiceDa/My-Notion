# My-Notion CLI 使用说明

My-Notion CLI 用来让用户或 Agent 通过命令行安全地操作 My-Notion 文档，包括创建、读取、更新、搜索、导入、导出和归档文档。

当前 CLI 的核心目标是：让 Agent 或用户把 Markdown 内容写入 My-Notion 文档。

## 0. 当前项目线上版怎么用

如果你要连接当前这个 My-Notion 项目已经在线运行的服务，使用流程是：

```text
打开 My-Notion Web -> 登录账号 -> 打开设置 -> API Tokens -> 创建 token -> 复制 mnt_ 开头的 PAT -> 用 CLI auth login 登录 -> 执行 docs 命令
```

当前项目的默认 Machine API 地址是：

```bash
https://handsome-stoat-500.convex.site
```

如果用户不指定 `--api-url`，CLI 默认使用这个线上地址。登录命令示例：

```bash
my-notion auth login \
  --token "mnt_xxx"
```

登录后先检查：

```bash
my-notion auth status --format json
```

然后就可以创建或搜索文档：

```bash
my-notion docs search --query "项目周报" --format json

my-notion docs create \
  --title "项目周报" \
  --content-file ./weekly-report.md \
  --format json
```

### PAT 在哪里创建

PAT 不是在命令行里生成的，而是在 My-Notion Web 里由当前登录用户创建：

1. 打开线上 My-Notion Web。
2. 登录你的账号。
3. 打开设置弹窗。
4. 找到 `API Tokens` 区域。
5. 输入 token 名称，例如 `Local CLI` 或 `Agent Writer`。
6. 勾选权限：
   - `docs:read`：读取、搜索、导出文档。
   - `docs:write`：创建、更新、导入、归档文档。
7. 可选填写过期时间。
8. 点击创建 token。
9. 复制生成的 `mnt_...` token。

注意：完整 PAT 只会显示一次。复制后请保存到本机密码管理器或安全位置，不要写进代码仓库、聊天记录或公开文档。

### API 地址在哪里看

当前项目可以直接使用：

```bash
https://handsome-stoat-500.convex.site
```

如果以后换了 Convex 部署，API 地址有两种确认方式：

- 优先查看 `apps/web/.env.local` 里的 `NEXT_PUBLIC_CONVEX_SITE_URL`。
- 如果只有 `NEXT_PUBLIC_CONVEX_URL=https://xxx.convex.cloud`，把 `.convex.cloud` 改成 `.convex.site`。

例如：

```text
NEXT_PUBLIC_CONVEX_URL=https://handsome-stoat-500.convex.cloud
```

对应 CLI API URL 是：

```text
https://handsome-stoat-500.convex.site
```

## 1. 准备工作

使用 CLI 前需要准备：

- 一个 My-Notion 账号。
- 一个 My-Notion Personal Access Token，简称 PAT。
- PAT 以 `mnt_` 开头。
- 服务端 API 地址；不指定时默认使用当前线上地址：

```bash
https://handsome-stoat-500.convex.site
```

- 如需连接其他部署，可指定 Convex `.site` 地址，例如：

```bash
https://<deployment>.convex.site
```

## 2. 安装或运行 CLI

如果 CLI 已经全局安装，可以直接使用：

```bash
my-notion <command>
```

如果是在项目仓库内开发运行，可以用：

```bash
pnpm --filter @notion/my-notion-cli dev <command>
```

例如：

```bash
pnpm --filter @notion/my-notion-cli dev auth status
```

如果要先构建再运行：

```bash
pnpm --filter @notion/my-notion-cli build
node packages/my-notion-cli/dist/index.js <command>
```

## 3. 登录 CLI

使用 PAT 登录：

```bash
my-notion auth login \
  --token "mnt_xxx"
```

如果要连接非默认部署，再额外传入 `--api-url "https://<deployment>.convex.site"`。

登录成功后，CLI 会把配置保存到本地：

```text
~/.my-notion/config.json
```

之后再执行命令时，不需要重复传 `--token`；默认线上地址也不需要重复传 `--api-url`。

## 4. 检查登录状态

```bash
my-notion auth status
```

推荐 Agent 使用 JSON 输出：

```bash
my-notion auth status --format json
```

## 5. 创建文档

直接传 Markdown 内容：

```bash
my-notion docs create \
  --title "项目周报" \
  --content "# 项目周报\n\n本周完成了 CLI/MCP 文档写入能力。" \
  --format json
```

更推荐的方式是：先把长内容写入 Markdown 文件，再用文件创建文档。

```bash
my-notion docs create \
  --title "项目周报" \
  --content-file ./weekly-report.md \
  --format json
```

创建成功后会返回文档 ID，后续读取、更新、导出都需要用这个 ID。

## 6. 读取文档

读取文档并返回 JSON：

```bash
my-notion docs fetch \
  --id "<documentId>" \
  --format json
```

如果只想拿 Markdown 正文：

```bash
my-notion docs fetch \
  --id "<documentId>" \
  --format markdown
```

Agent 场景建议：

- 需要结构化信息时用 `--format json`。
- 需要继续编辑正文时用 `--format markdown`。

## 7. 搜索文档

按关键词搜索：

```bash
my-notion docs search \
  --query "项目周报" \
  --limit 10 \
  --format json
```

建议在创建新文档前，先搜索是否已有类似文档，避免重复创建。

## 8. 列出文档

```bash
my-notion docs list \
  --limit 20 \
  --format json
```

## 9. 更新文档

追加内容：

```bash
my-notion docs update \
  --id "<documentId>" \
  --mode append \
  --content "追加一段新的会议纪要。" \
  --format json
```

使用 Markdown 文件追加：

```bash
my-notion docs update \
  --id "<documentId>" \
  --mode append \
  --content-file ./meeting-notes.md \
  --format json
```

覆盖全文：

```bash
my-notion docs update \
  --id "<documentId>" \
  --mode overwrite \
  --content-file ./new-content.md \
  --format json
```

注意：

- `append` 更安全，适合追加笔记、会议纪要、任务记录。
- `overwrite` 会替换原文档内容，只有在明确需要重写全文时使用。

## 10. 导出文档

导出为 Markdown 文件：

```bash
my-notion docs export \
  --id "<documentId>" \
  --output ./exported-document.md
```

如果想看 JSON 结果：

```bash
my-notion docs export \
  --id "<documentId>" \
  --output ./exported-document.md \
  --format json
```

## 11. 导入 Markdown

把本地 Markdown 文件导入为 My-Notion 文档：

```bash
my-notion docs import \
  --title "导入的文档" \
  --file ./document.md \
  --format json
```

适合场景：

- Agent 先生成一份较长 Markdown。
- 用户确认后，用 CLI 导入到 My-Notion。
- 从其他系统迁移 Markdown 笔记。

## 12. 归档文档

归档是软删除，文档不会直接硬删除：

```bash
my-notion docs archive \
  --id "<documentId>" \
  --format json
```

归档后，该文档不会出现在正常搜索、列表和读取结果中。

## 13. 退出登录

只清除本机保存的 token，不会撤销服务端 PAT：

```bash
my-notion auth logout
```

## 14. 撤销当前 PAT

如果这个 PAT 不再使用，建议服务端撤销：

```bash
my-notion tokens revoke-current --format json
```

撤销后，这个 token 将无法继续访问 My-Notion API。

## 15. 输出格式

CLI 支持多种输出格式：

```bash
--format json
--format pretty
--format table
--format ndjson
--format markdown
```

推荐用法：

- Agent 调用：优先 `--format json`。
- 人类查看：可以用 `--format pretty` 或 `--format table`。
- 读取正文：用 `--format markdown`。
- 流式或管道处理：用 `--format ndjson`。

## 16. 环境变量配置

如果不想写入本地配置文件，也可以用环境变量。`MY_NOTION_API_URL` 可选，不设置时默认使用 `https://handsome-stoat-500.convex.site`：

```bash
export MY_NOTION_API_URL="https://<deployment>.convex.site"
export MY_NOTION_API_TOKEN="mnt_xxx"
```

然后直接执行：

```bash
my-notion auth status
my-notion docs search --query "项目" --format json
```

配置优先级：

- 命令行参数最高，例如 `--api-url`、`--token`。
- 环境变量其次。
- `~/.my-notion/config.json` 再次。
- 默认线上地址 `https://handsome-stoat-500.convex.site` 最后。

## 17. 推荐完整流程

普通用户或 Agent 推荐这样使用：

```bash
# 1. 登录
my-notion auth login \
  --token "mnt_xxx"

# 2. 检查状态
my-notion auth status --format json

# 3. 搜索是否已有类似文档
my-notion docs search \
  --query "项目周报" \
  --limit 10 \
  --format json

# 4. 创建文档
my-notion docs create \
  --title "项目周报" \
  --content-file ./weekly-report.md \
  --format json

# 5. 后续追加内容
my-notion docs update \
  --id "<documentId>" \
  --mode append \
  --content-file ./append-notes.md \
  --format json

# 6. 导出备份
my-notion docs export \
  --id "<documentId>" \
  --output ./backup.md

# 7. 不再使用时退出登录
my-notion auth logout
```

## 18. 安全注意事项

- 不要把完整 PAT 写进聊天记录、日志、文档或代码仓库。
- PAT 只应保存在本地配置、环境变量或安全的密钥管理系统中。
- 如果怀疑 PAT 泄漏，立即执行：

```bash
my-notion tokens revoke-current --format json
```

- Agent 创建新文档前，建议先 `docs search`，避免重复创建。
- Agent 修改已有文档时，优先使用 `--mode append`。
- 只有用户明确要求替换全文时，才使用 `--mode overwrite`。

## 19. 常见错误

- `UNAUTHORIZED`：没有登录、token 缺失、token 无效或已撤销。
- `INSUFFICIENT_SCOPE`：当前 PAT 权限不足，例如只有读权限但执行了写操作。
- `TOKEN_EXPIRED`：PAT 已过期，需要重新生成。
- `TOKEN_REVOKED`：PAT 已撤销，需要换新 token。
- `VALIDATION_ERROR`：参数不合法，例如标题为空、缺少文档 ID。
- `NOT_FOUND`：文档不存在、已归档或无权访问。
- `RATE_LIMITED`：请求太频繁，等待 `Retry-After` 后再试。

## 20. 一句话总结

使用 My-Notion CLI 的完整流程是：

```text
生成 PAT -> auth login -> auth status -> search/list -> create/import -> fetch/update/export -> archive/logout/revoke
```

Agent 场景下最推荐的写文档方式是：

```text
先生成 Markdown 文件 -> 用 docs create/import 写入 -> 后续用 docs update --mode append 追加
```
