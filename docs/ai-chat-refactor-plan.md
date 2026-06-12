# AI Chat 重构方案：当前基线与下一步


---

## 当前基线

| 模块 | 已完成 | 当前缺口 |
|---|---|---|
| 工程基线 | `@notion/web` 已新增 `typecheck` script；`tsconfig` 不再 include `.next/dev` stale types；`build` 和 `typecheck` 可作为基础验证入口 | 后续每轮能力变更继续跑 `typecheck/build/lint` |
| Agent Loop | ReAct 循环、标准 tool calling、最多 5 轮、达到上限后强制最终回答、本轮缓存与跨请求只读缓存、结构化 trace、Plan 模式最小闭环、流式续跑可用闭环 | 步骤级执行进度持久化和恢复可后续增强 |
| Tools | 已有 `knowledge_search`、`web_search`、`web_extract`、`document_search`、`document_read`、`memory_search`、`memory_write`、`document_write`、`document_update`、`task_plan`、受控 `mcp_my_notion_call` | tool registry 仍主要在 `apps/web`，后续可按跨端/包化再抽象 |
| Tool 容错 | 所有 tool execute 已接入统一 fallback 边界，异常时返回 `{ error, summary, recoverable, sources, metadata }`；`sources` 已收敛为 `document/web/memory` 强类型 union；MCP `docs_fetch` 已防护非 documents ID | 后续可补更细粒度 source 字段和 UI 展示 |
| Memory | `agentMemories` 数据模型、Inbox 确认式写入、已生效记忆列表、规则设置、语义检索 + token/recency fallback、写入/编辑/停用后缓存清理与 Qdrant 同步 | embedding 状态可视化、失败重试队列暂缓 |
| RAG | `retrieveKnowledge(options)` 支持 `fast/balanced/deep`；默认 `balanced`；已有 hybrid recall、RRF、context packing、citation quality、最小 synthetic eval | 真实/脱敏 eval、rerank adapter 暂缓 |
| Harness | Agent 单测、AI Chat 组件测试、mock E2E 用例、本地 `ci:ai-smoke`、无 secrets 版 AI smoke workflow | Storybook、Memory eval、real retrieval eval、Tool Trace Replay、Agent golden set 继续暂缓 |

---

## 已完成能力压缩清单

- **UI/组件**：AI Chat sidebar、组件拆分、错误边界、自动滚动优化、Tool 卡片上下位置规则、重复只读工具折叠。
- **Agent 基础**：ReAct loop、DashScope thinking 兼容、context compression、rate limiting、tool result cache、Agent trace console 观测、Plan 模式最小闭环。
- **工具生态**：知识库检索、联网搜索、网页抽取、文档搜索/读取/写入/更新、长期记忆读取/写入、任务计划生成与确认执行。
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
| Plan 模式最小闭环 | ✅ 完成 | Plan 模式只生成 `task_plan`；用户确认后按计划以 Chat 模式继续执行 |

### P1：产品基础能力

1. **Web Agent MCP adapter**：✅ 已完成最小闭环。复用现有 CLI/MCP 能力扩展工具生态，第一版通过受控 My-Notion MCP 文档工具白名单接入，并继续遵守确认式写入。
2. **流式重试与续跑**：✅ 已完成可用闭环。网络中断且尚未收到任何事件时支持安全重试；已输出后的 checkpoint/resume 支持事件持久化、backlog replay、失败 run checkpoint 恢复、“继续生成”入口、assistant 消息原地更新和 running run 长轮询接管；协议见 `docs/agent-stream-resume-protocol.md`。
3. **Tool 结果契约细化**：✅ 已完成主要 Web Agent tools 收敛。新增 `tool-result-v1`，主要工具均稳定携带 `summary/sources/metadata/recoverable`，且 `sources` 已强类型化。
4. **Plan 状态增强**：✅ 已完成最小闭环。确认执行状态可写回并恢复；步骤级事件和完整跨刷新恢复后置。

### P2：治理与体验增强（后置）

1. **Memory 增强**：embedding 同步状态、失败重试队列和更清晰的 Inbox 审核体验。
2. **RAG 质量增强**：真实/脱敏样本 eval、query-aware diversity、rerank adapter 评估。
3. **Trace Sink / Replay**：将 `AgentTracer` 接入持久化事件表或 Sentry span，后续再做 Replay UI。
4. **Storybook**：补 AI Chat 主要组件可视化文档。

### P3：Harness 后置

1. **Tool Trace Replay / Agent Eval**：基于持久化 trace 做 golden set、tool 调用期望和 replay 对比。
2. **Memory Eval / Real Retrieval Eval**：形成长期质量回归指标。
3. **认证态 E2E CI**：当前保留本地可选验证，等 Clerk/Convex secrets 有时间整理后再接回 CI 门禁。

---

## 下一批里程碑建议

| 里程碑 | 范围 | 完成标准 |
|---|---|---|
| M19 | Planning 基础能力 | ✅ 已完成：展示计划、确认计划、执行步骤、状态可见 |
| M20 | MCP 扩展 | ✅ 已完成最小闭环：Web Agent 能安全调用受控 My-Notion MCP adapter，并继续遵守确认式写入 |
| M21 | 韧性与治理 | ✅ 已完成：流式安全重试、`tool-result-v1` 契约统一、强类型 sources、Plan 执行状态持久化 |

---

## 当前建议下一步

1. Web Agent 基础操作已闭环，后续只保留真实对话冒烟验证和小修。
3. 设计 `metadata in DB + scene/blob in object storage` 的迁移方案，确保不恢复 Convex DB 热路径大对象读写。
4. Harness、Trace Replay、Storybook 和真实质量评估继续后置。
