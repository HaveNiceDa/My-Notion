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
8. `docs/ai-chat-refactor-plan.md`：M17/M18 后的当前 Agent 基线与 M19-M22 下一阶段建议。
9. `progress/20260527-20260531-consolidated.md`：近期 Web Agent、CLI/Skills/MCP、Device Flow 与 npm beta 发布的压缩过程记录。

## 当前总状态

- M10 ✅ 已完成：AI Chat 侧边栏重构。
- M11 ✅ 已完成：Agent Stream + Knowledge Search Tool。
- M12 ✅ 已完成：Agent Auto Tool Routing。
- M13 ✅ 已完成：Document Read Tool。
- M14 ✅ 已完成：ReAct Agent Loop 重构。
- M15 ✅ 已完成：AI Chat UX 与 Markdown 渲染打磨。
- M16 ✅ 已完成：Agent 可通过 CLI / Skills / MCP STDIO 安全写入 My-Notion 文档；`@mynotion/cli@0.1.0-beta.0` 已发布。
- M17 ✅ 已完成：Web Agent 主线、Memory MVP、Hybrid Retrieval、文档写入 dry-run 与前端确认。
- M18 ✅ 部分完成并后置 Harness：Agent 单测、AI Chat 组件/流客户端测试、最小 retrieval eval、`ci:ai-smoke` 和无 secrets 版 GitHub Actions 已完成；Storybook、Trace Replay、Memory/RAG 真实评估后置。

## 下一批候选里程碑

- M19 ⏳ 下一步：Planning 基础能力。重点完成 Plan 模式最小闭环：展示计划、确认计划、执行步骤、状态可见。
- M20 ⏳ 候选：Spec + MCP 扩展。复杂写入前生成结构化规格，Web Agent 安全调用受控 MCP adapter。
- M21 ⏳ 候选：韧性与治理。流式重试、Memory 同步状态、Tool 结果契约进一步统一。
- M22 ⏳ 后置：Harness 回补。Trace sink、Tool Trace Replay、Storybook、Memory/RAG 真实质量评估。
- 详细路线见 `docs/ai-chat-refactor-plan.md`。

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
