# AI Chat 重构方案：当前基线与下一步

> Phase 1-5 已在 M10-M14 完成；M16 收口 CLI / Skills / MCP Agent 写文档链路；M17 完成 Web Agent 主线、Memory MVP、Hybrid Retrieval、文档写入 dry-run 与前端确认；M18 已补 Agent 单测、AI Chat 组件/流客户端测试、最小 retrieval eval、`pnpm ci:ai-smoke` 和无 secrets 版 GitHub Actions。当前策略调整为：Harness 暂缓，先补齐基础 Agent 能力并保证本地验证闭环。

---

## 当前基线

| 模块 | 已完成 | 当前缺口 |
|---|---|---|
| 工程基线 | `@notion/web` 已新增 `typecheck` script；`tsconfig` 不再 include `.next/dev` stale types；`build` 和 `typecheck` 可作为基础验证入口 | 后续每轮能力变更继续跑 `typecheck/build/lint` |
| Agent Loop | ReAct 循环、标准 tool calling、最多 5 轮、达到上限后强制最终回答、本轮缓存与跨请求只读缓存、结构化 trace | Plan 模式仍需产品化确认与执行闭环 |
| Tools | 已有 `knowledge_search`、`web_search`、`web_extract`、`document_search`、`document_read`、`memory_read`、`memory_write`、`document_write`、`document_update`、`task_plan` | Web Agent MCP adapter 未做；tool registry 仍主要在 `apps/web` |
| Tool 容错 | 所有 tool execute 已接入统一 fallback 边界，异常时返回 `{ error, summary, recoverable, sources, metadata }`，LLM 可继续推理 | 业务内 validation error 还可继续逐步补齐更统一的 `summary/sources/metadata` |
| Memory | `agentMemories` 数据模型、Memory Review UI、确认式写入、语义检索 + token/recency fallback、写入/编辑/停用后缓存清理与 Qdrant 同步 | embedding 状态可视化、失败重试队列暂缓 |
| RAG | `retrieveKnowledge(options)` 支持 `fast/balanced/deep`；默认 `balanced`；已有 hybrid recall、RRF、context packing、citation quality、最小 synthetic eval | 真实/脱敏 eval、rerank adapter 暂缓 |
| Harness | Agent 单测、AI Chat 组件测试、mock E2E 用例、本地 `ci:ai-smoke`、无 secrets 版 AI smoke workflow | Storybook、Memory eval、real retrieval eval、Tool Trace Replay、Agent golden set 暂缓 |

---

## 已完成能力压缩清单

- **UI/组件**：AI Chat sidebar、组件拆分、错误边界、自动滚动优化、Tool 卡片上下位置规则、重复只读工具折叠。
- **Agent 基础**：ReAct loop、DashScope thinking 兼容、context compression、rate limiting、tool result cache、Agent trace console 观测。
- **工具生态**：知识库检索、联网搜索、网页抽取、文档搜索/读取/写入/更新、长期记忆读取/写入、任务计划生成。
- **安全写入**：所有写类 tool 遵循“预览 -> 用户确认 -> 落库”，默认 dry-run 或 confirmationRequired。
- **验证入口**：Web unit、Agent unit、`eval:retrieval`、`ci:ai-smoke`、无 secrets 版 GitHub Actions。

---

## 新优先级

### P0：基础能力补齐与验证

| 项目 | 状态 | 完成标准 |
|---|---|---|
| typecheck/build 基线 | ✅ 完成 | `pnpm --filter @notion/web typecheck` 和 `pnpm --filter @notion/web build` 可跑通 |
| Tool 失败降级统一契约 | ✅ 完成 | tool 抛异常时统一转为 recoverable 结构化结果，ReAct 不因单个工具失败中断 |
| `task_plan` tool | ✅ 完成 | Agent 可生成多步骤计划；前端 Tool 卡片可展示步骤和状态；已纳入 registry 和测试 |

### P1：产品基础能力

1. **Plan 模式最小闭环**：基于 `task_plan` 做“生成计划 -> 用户确认 -> 步骤执行/状态展示”。
2. **Web Agent MCP adapter**：复用现有 CLI/MCP 能力扩展工具生态，但继续遵守确认式写入。
3. **流式重试**：网络中断时支持自动重试或给出可恢复续跑路径。
4. **Tool 结果契约细化**：逐步让业务内 validation error 也统一带 `summary/sources/metadata/recoverable`。

### P2：治理与体验增强

1. **Memory 增强**：embedding 同步状态、失败重试队列、记忆冲突治理增强。
2. **RAG 质量增强**：真实/脱敏样本 eval、query-aware diversity、rerank adapter 评估。
3. **Trace Sink**：将 `AgentTracer` 接入持久化事件表或 Sentry span。
4. **Storybook**：补 AI Chat 主要组件可视化文档。

### P3：Harness 后置

1. **Tool Trace Replay / Agent Eval**：基于持久化 trace 做 golden set、tool 调用期望和 replay 对比。
2. **Memory Eval / Real Retrieval Eval**：形成长期质量回归指标。
3. **认证态 E2E CI**：当前保留本地可选验证，等 Clerk/Convex secrets 有时间整理后再接回 CI 门禁。

---

## 下一批里程碑建议

| 里程碑 | 范围 | 完成标准 |
|---|---|---|
| M19 | Planning 基础能力 | Plan 模式最小闭环：展示计划、确认计划、执行步骤、状态可见 |
| M20 | MCP 扩展 | Web Agent 能安全调用受控 MCP adapter，并继续遵守确认式写入 |
| M21 | 韧性与治理 | 流式重试、Memory 同步状态、Tool 结果契约进一步统一 |
| M22 | Harness 回补 | Trace sink、Tool Trace Replay、Storybook、Memory/RAG 真实质量评估 |

---

## 当前建议下一步

1. 先做 **Plan 模式最小闭环**，因为 `task_plan` 已完成，是最直接的基础能力延伸。
2. 然后做 **Web Agent MCP adapter**，补工具生态。
3. 再补 **流式重试与 Tool 结果契约细化**，提高执行韧性。
4. 最后回补 Harness、Trace Replay 和真实质量评估。
