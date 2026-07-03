# My-Notion 里程碑索引

## 目的

`milestones/` 保存稳定阶段结论，适合快速理解“项目已经完成了什么、关键设计为什么这样做、下一步该接哪里”。

`progress/` 保存过程摘要；`milestones/` 只保留沉淀后的工程事实。

## 专题索引

| 方向 | 文档 |
| --- | --- |
| Web Agent 成型 | `M10` -> `M11` -> `M12` -> `M13` -> `M14` -> `M15` |
| Agent 写文档与外部生态 | `M16` -> `M20` -> `M28` |
| Plan 与流式治理 | `M19` -> `M21` -> `docs/agent-stream-resume-protocol.md` |
| Memory 产品化 | `docs/agent-memory-redesign-report.md` -> `M23` -> `M24` -> `M25` -> `M26` -> `M27` |
| Mobile 后续路线 | `docs/web-mobile-gap-analysis.md` -> `M29` -> `M30` |

## 阶段摘要

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| M10-M15 | ✅ 完成 | AI Chat 从页面重构为侧边栏，并完成 Agent Stream、自动工具路由、当前文档读取、ReAct Loop 和 Markdown 展示体验。 |
| M16 | ✅ 完成 | CLI / Skills / MCP 打通 Agent 写文档链路，确立 Markdown 契约和确认式写入边界。 |
| M19 | ✅ 完成 | Plan 模式最小闭环，支持计划生成、用户确认、确认后执行和状态可见。 |
| M20-M21 | ✅ 完成 | Web Agent 接入受控 MCP adapter，统一 `tool-result-v1`，补齐强类型 sources、流式安全重试和 checkpoint/resume。 |
| M23-M27 | ✅ 完成 | Memory 从单点保存升级为 Context Governance System，覆盖 schema、检索、Inbox、Memory Center、Eval 和自动提取。 |
| M28 | ✅ 完成 | MCP 从 CLI 子命令拆成独立 `@mynotion/mcp` 包，CLI/MCP 共享 `@mynotion/agent-tools`，保留兼容入口。 |
| M29 | 规划中 | Mobile AI Native Client，聚焦 Agent Stream 真机验证、弱网恢复、resume、本地缓存和错误边界。 |
| M30 | 规划中 | Mobile Editor Deepening，聚焦正文图片、复杂 block 降级、键盘/选区、长文和弱网保存。 |

## 当前总状态

- M10 ✅ 已完成：AI Chat 侧边栏重构。
- M11 ✅ 已完成：Agent Stream + Knowledge Search Tool。
- M12 ✅ 已完成：Agent Auto Tool Routing。
- M13 ✅ 已完成：Document Read Tool。
- M14 ✅ 已完成：ReAct Agent Loop 重构。
- M15 ✅ 已完成：AI Chat UX 与 Markdown 渲染打磨。
- M16 ✅ 已完成：Agent 可通过 CLI / Skills / MCP STDIO 安全写入 My-Notion 文档；CLI 首个 stable 版本已发布到 `latest`。
- M17 ✅ 已完成：Web Agent 主线、Memory MVP、Hybrid Retrieval、文档写入 dry-run 与前端确认。
- M18 ✅ 部分完成并后置 Harness：Agent 单测、AI Chat 组件/流客户端测试、最小 retrieval eval、`ci:ai-smoke` 和无 secrets 版 GitHub Actions 已完成；Storybook、Trace Replay、Memory/RAG 真实评估后置。
- M19 ✅ 已完成：Plan 模式最小闭环，支持展示计划、确认计划、确认后执行和状态可见。
- M20 ✅ 已完成最小闭环：Web Agent 通过受控 My-Notion MCP adapter 调用白名单文档工具，并继续遵守确认式写入。
- M21 ✅ 已完成操作闭环：流式安全重试、主要 Web Agent tools 的 `tool-result-v1` 契约统一、强类型 sources、Plan 执行状态持久化、流式续跑可用闭环，以及 2026-06-07 的 AI 工具交互治理与 MCP ID 防护。
- M23-M27 ✅ 已完成：Agent Memory 从 MVP 升级为 Context Governance System，覆盖 schema、检索运行时、Inbox、Memory Center、Eval 和受控自动提取。
- M28 ✅ 已完成：独立 `@mynotion/mcp` 与内部共享 `@mynotion/agent-tools` 已发布验证，保留 CLI 兼容入口。
- M29 规划中：Mobile AI Native Client，补齐真机 Agent Stream、checkpoint/resume、本地缓存和弱网恢复。
- M30 规划中：Mobile Editor Deepening，补齐正文图片、复杂 block 降级、键盘/选区和长文编辑体验。

## 下一批候选里程碑

- M29：Mobile AI Native Client，围绕 Expo / React Native 客户端学习与建设，继续补强 Agent Stream、checkpoint/resume、AI Chat 状态机、本地缓存和弱网恢复。
- M30：Mobile Editor Deepening，验证并补强正文图片插入/上传、复杂 block 移动端降级、键盘/选区/工具栏和长文编辑体验。
- Harness / Trace Replay / Storybook / Memory-RAG 真实评估继续后置，不作为当前主线。
- 详细路线见 `docs/web-mobile-gap-analysis.md` 与 `docs/ai-chat-refactor-plan.md`。

## Agent Memory 重构待办

M23-M27 是基于 `docs/agent-memory-redesign-report.md` 拆出的独立 Memory 产品化路线，与 M20-M22 并行但不冲突。当前主线已按顺序完成：

1. M23 ✅：扩展 `agentMemories` schema 与兼容层，让后续所有阶段有稳定字段基础。
2. M24 ✅：在 schema 基础上重构纯读检索和运行时注入，避免读路径 upsert 与 system prompt 污染。
3. M25 ✅：引入 pending review 与 Inbox，让 Agent 写入从单点确认升级为可治理的确认链路。
4. M26 ✅：重构 `/memories` 为 Memory Center，让用户能查看和确认待处理记忆、已生效记忆与规则设置。
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
pnpm --filter @mynotion/mcp build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```
