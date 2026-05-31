# 2026-05-31 CLI README 信息架构优化

## 背景

用户希望参考 `larksuite/cli` README 的信息组织方式，优化 My-Notion CLI 的描述，使其更适合人类用户和 AI Agent 快速理解与使用。

## 改动

- 重写 `packages/my-notion-cli/README.md`：
  - 增加一句话定位、锚点导航、Why My-Notion CLI、能力概览。
  - 拆分 Human Users 与 AI Agent 两套 Quick Start。
  - 明确浏览器 Device Flow 是主登录方式，Agent 输出授权链接必须使用 Markdown 可点击链接。
  - 明确线上 `prod` 与本地 `--local` 登录态隔离。
  - 增加命令体系、MCP STDIO、Agent Skills、输出格式和安全边界。
- 更新根 `README.md` 的 CLI / MCP Quick Start：
  - 移除以手动 PAT 为主的旧流程。
  - 改为浏览器授权登录主链路。
  - 补充 `--local` 本地调试和 `config.local.json` 说明。
- 优化 `packages/my-notion-skills/README.md`：
  - 增加 Skill 表格、Agent 输出规则和安全口径。
- 更新 `packages/my-notion-cli/package.json` 描述为 `Agent-native CLI and MCP adapter for My-Notion documents`。
- 将 `.trae/skills/my-notion-shared` 中已有的有效 Usage Modes 补充合并回源文件，保证源目录与同步目标一致。

## 验证

- `pnpm sync:skills:check`：通过。
- `pnpm --filter @notion/my-notion-cli typecheck`：通过。
- VS Code diagnostics：无新增错误。
