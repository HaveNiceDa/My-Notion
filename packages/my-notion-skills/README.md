# My-Notion Skills

Agent Skills 源文件目录，负责指导 Agent 安全、稳定地调用 My-Notion CLI 和 MCP STDIO server。

## Skills

- `my-notion-shared`：CLI 安装、认证、PAT 安全、输出格式和通用规则。
- `my-notion-docs`：通过 CLI 创建、读取、搜索、更新、导入、导出和归档 My-Notion 文档。
- `my-notion-mcp`：启动 MCP STDIO server，并通过 MCP tools 搜索、读取、创建和更新文档。

## Sync

修改本目录后运行：

```bash
pnpm sync:skills
pnpm sync:skills:check
```

同步目标：

```text
.trae/skills/
```

## Safety

- 不在 Skill 文档中写入完整 PAT。
- CLI 默认连接 `https://laudable-albatross-174.convex.site`；连接其他部署时再传 `--api-url` 或设置 `MY_NOTION_API_URL`。
- 写文档优先使用临时 Markdown 文件和 `--content-file`。
- MCP 写工具默认 `dryRun: true`，只有用户明确批准后才执行真实写入。
- CLI 写命令必须使用 `--format json` 便于 Agent 解析结果。
