# M20: Web Agent MCP Adapter

## 状态总览

- 状态：已完成最小闭环。
- 更新时间：2026-06-05。
- 本阶段交付目标：让 Web Agent 通过受控 My-Notion MCP adapter 调用 MCP 工具能力，并继续遵守确认式写入。

## 目标

复用既有 My-Notion CLI/MCP 工具契约，把 MCP 能力纳入 Web Agent 现有 ReAct Loop 与 tool registry，而不是另起一套 Agent 执行链路。第一版以安全可控为主，写入类工具只产出 dry-run 预览，真实写入仍由用户在前端确认。

## 已完成

### 受控 Adapter

- 新增 `mcp_my_notion_call` Agent Tool。
- adapter 采用 `in_process` 实现，不启动 STDIO 子进程，不连接任意外部 MCP server。
- 第一版仅开放文档工具白名单：
  - `my_notion_docs_search`
  - `my_notion_docs_fetch`
  - `my_notion_docs_create`
  - `my_notion_docs_update`

### 安全写入

- `my_notion_docs_create` 和 `my_notion_docs_update` 在 adapter 层强制 `dryRun: true`。
- 即使模型传入 `dryRun: false`，Web Agent 也只返回 `confirmationRequired` 预览。
- 写入预览复用现有 `document_write` / `document_update` 结果结构。
- 真实落库继续由 `ToolCallCard` 的确认按钮触发 Convex mutation。

### 前端展示

- `ToolCallCard` 支持展示 MCP adapter 读工具结果。
- MCP 写工具复用现有文档写入确认 UI。
- 新增 `mcpMyNotionTool` 中英文文案。

### 测试覆盖

- 补充 MCP adapter 单测，覆盖白名单校验、docs search、docs create dry-run、docs update dry-run。
- 补充 tool registry / definition 测试，确保 `mcp_my_notion_call` 出现在 Web Agent 可用工具中。

## 关键决策

- 第一版只做受控 My-Notion MCP adapter，不做通用 MCP client，降低 token、权限和任意工具执行风险。
- Web Agent 继续复用当前 ReAct Loop、tool fallback、ToolCallCard 和确认式写入链路。
- `docs_fetch` 的 Markdown 转换在 Web runtime 内部轻量实现，避免把 Convex server 模块导入 Next API route。

## 验证

- `pnpm --filter @notion/web test -- src/lib/agent/__tests__/tools.test.ts`：✅，实际运行 Web 侧 11 个测试文件，117 个测试通过。
- `pnpm --filter @notion/web typecheck`：✅
- `pnpm --filter @notion/web lint`：✅，仅有既有 warning，无 error。
- `pnpm --filter @notion/web build`：✅
- VS Code diagnostics：✅，新增/修改核心文件无错误。

## 已知缺口

- Tool 结果契约尚未完全统一到 M21 目标形态。
- 尚未接入 Trace Replay / Agent Eval。
- 尚未做外部 MCP server、HTTP MCP、OAuth 2.1。
- `docs_fetch` 的复杂 BlockNote 转 Markdown 覆盖仍需按真实 case 增强。

## 关联文档

- `docs/ai-chat-refactor-plan.md`
- `milestones/M16-cli-skills-mcp-agent-docs.md`
- `milestones/M19-plan-mode-minimal-loop.md`
- `progress/20260605-233018.md`
- `apps/web/src/lib/agent/tools/mcp-adapter.ts`
- `apps/web/src/lib/agent/tools/definitions.ts`
- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
