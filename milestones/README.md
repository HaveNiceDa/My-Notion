# My-Notion 里程碑索引

## 目的

`progress/` 现在只保留压缩后的阶段摘要，避免旧中间态误导后续 Agent。

`milestones/` 用于把阶段摘要进一步收敛成稳定结论，适合后续喂给 AI 快速理解项目状态。

## 阅读顺序

1. `M10-ai-chat-sidebar.md`：AI Chat 从独立页面重构为右侧可拖拽侧边栏面板。
2. `M11-agent-stream-rag-tool.md`：AI Chat 后端从单一 RAG pipeline 重构为 Agent + Tool 架构。
3. `M12-agent-auto-tool-routing.md`：移除显式 RAG 开关，Agent 统一 auto 模式。
4. `M13-document-read-tool.md`：当前文档读取能力接入 Agent 体系。
5. `M14-react-agent-loop.md`：硬编码 tool 路由重构为标准 ReAct 循环，LLM 自主决策工具调用。
6. `M15-ux-polish-markdown-rendering.md`：AI Chat 展示、Markdown 渲染和交互体验打磨。
7. `M16-cli-skills-mcp-agent-docs.md`：CLI / Skills / MCP Agent 写文档能力交付。
8. `M19-plan-mode-minimal-loop.md`：Plan 模式最小闭环，覆盖计划生成、用户确认与确认后执行。
9. `docs/ai-chat-refactor-plan.md`：M19 后的当前 Agent 基线与 M20-M22 下一阶段建议。
10. `docs/agent-memory-redesign-report.md`：Agent Memory 当前问题分析与完整重构设计。
11. `M23-agent-memory-schema-foundation.md`：Memory schema、兼容层、作用域、证据链和同步状态基础。
12. `M24-agent-memory-retrieval-runtime.md`：纯读检索、`memory_search`、scope-aware ranking 和 compact instruction memory。
13. `M25-agent-memory-inbox-confirmation.md`：Memory proposal、pending review、Inbox 和确认式提交链路。
14. `M26-agent-memory-center-ui.md`：`/memories` 从 CRUD 列表升级为 Memory Center。
15. `M27-agent-memory-eval-auto-extraction.md`：Memory eval、trace 观测和受控自动提取。
16. `progress/20260527-20260531-consolidated.md`：近期 Web Agent、CLI/Skills/MCP、Device Flow 与 npm beta 发布的压缩过程记录。
17. `progress/20260602-173825.md`：M19 Plan 模式最小闭环的过程记录。

## 当前总状态

- M10 ✅ 已完成：AI Chat 侧边栏重构。
- M11 ✅ 已完成：Agent Stream + Knowledge Search Tool。
- M12 ✅ 已完成：Agent Auto Tool Routing。
- M13 ✅ 已完成：Document Read Tool。
- M14 ✅ 已完成：ReAct Agent Loop 重构。
- M15 ✅ 已完成：AI Chat UX 与 Markdown 渲染打磨。
- M16 ✅ 已完成：Agent 可通过 CLI / Skills / MCP STDIO 安全写入 My-Notion 文档；`@mynotion/cli@0.1.0-beta.1` 已发布到 `beta` 和 `latest`。
- M17 ✅ 已完成：Web Agent 主线、Memory MVP、Hybrid Retrieval、文档写入 dry-run 与前端确认。
- M18 ✅ 部分完成并后置 Harness：Agent 单测、AI Chat 组件/流客户端测试、最小 retrieval eval、`ci:ai-smoke` 和无 secrets 版 GitHub Actions 已完成；Storybook、Trace Replay、Memory/RAG 真实评估后置。
- M19 ✅ 已完成：Plan 模式最小闭环，支持展示计划、确认计划、确认后执行和状态可见。
- M20 ✅ 已完成最小闭环：Web Agent 通过受控 My-Notion MCP adapter 调用白名单文档工具，并继续遵守确认式写入。
- M21 ✅ 已完成主要闭环：流式安全重试、主要 Web Agent tools 的 `tool-result-v1` 契约统一、强类型 sources、Plan 执行状态持久化，以及流式续跑 Phase 1/2/3。
- M23-M27 ✅ 已完成：Agent Memory 从 MVP 升级为 Context Governance System，覆盖 schema、检索运行时、Inbox、Memory Center、Eval 和受控自动提取。

## 下一批候选里程碑

- M22 ⏳ 后置：Harness 回补。running run live 接管、Trace sink、Tool Trace Replay、Storybook、Memory/RAG 真实质量评估。
- 详细路线见 `docs/ai-chat-refactor-plan.md`。

## Agent Memory 重构待办

M23-M27 是基于 `docs/agent-memory-redesign-report.md` 拆出的独立 Memory 产品化路线，与 M20-M22 并行但不冲突。当前主线已按顺序完成：

1. M23 ✅：扩展 `agentMemories` schema 与兼容层，让后续所有阶段有稳定字段基础。
2. M24 ✅：在 schema 基础上重构纯读检索和运行时注入，避免读路径 upsert 与 system prompt 污染。
3. M25 ✅：引入 pending review 与 Inbox，让 Agent 写入从单点确认升级为可治理的确认链路。
4. M26 ✅：重构 `/memories` 为 Memory Center，让用户能查看证据、同步状态、冲突和设置。
5. M27 ✅：补 Memory eval、trace 观测和受控自动提取，默认进入 Inbox，不直接写 active memory。

## 关键验证命令

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web build
pnpm --filter @notion/web lint
pnpm ci:ai-smoke
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```
