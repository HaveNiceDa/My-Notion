# @mynotion/agent-tools

My-Notion CLI / MCP 的内部共享工具层。它收敛 Machine API client、Agent 工具契约、文档 dry-run 逻辑、tool manifest 和 MCP readme helper。

这个包是 workspace private 包，不单独发布到 npm。`@mynotion/mcp` build 时会把它打进 MCP 产物，`@mynotion/cli` 通过 MCP 兼容入口复用同一套工具语义。

## 设计目标

- **Transport-agnostic**：不依赖 MCP SDK，也不依赖 CLI 输出格式。
- **单一工具契约**：搜索、读取、创建、更新文档的输入输出在 CLI/MCP 之间保持一致。
- **安全默认值**：写工具默认 dry-run，真实写入只能在上层明确传入 `dryRun=false` 后发生。
- **环境解析一致**：默认 `prod`，本地调试必须显式指定 local/profile，避免线上线下登录态混用。

## 包含内容

| 模块 | 用途 |
| --- | --- |
| `client/` | My-Notion Machine API HTTP client |
| `config/` | profile、endpoint、token 的解析规则 |
| `docs/` | 文档工具实现、manifest 和 `my_notion_readme` 内容 |
| `results/` | Agent tool result 的成功/错误包装 |

## Development

```bash
pnpm --filter @mynotion/agent-tools typecheck
pnpm --filter @mynotion/agent-tools test
pnpm --filter @mynotion/agent-tools build
```
