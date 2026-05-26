# AI Chat 重构方案：剩余待办

> Phase 1-5 已在 M10-M14 全部完成，CLI / Skills / MCP Agent 写文档链路已在 M16 收口。当前重新启动 Agent 能力建设，后续重点从“Agent 能跑”转向“工具更丰富、记忆更稳定、检索更可靠”。

---

## Phase 6：体验优化 + 工程化补齐（M15+）

### 6.1 技术债清理

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 1.1 | useAIChat.ts 拆分 | 已拆为 `useAIChatState` + `useAIChatStream` + `useAIChatPersistence` + `stream-client`，主文件仅 34 行组合层 | P1 | ✅ 完成 |
| 1.2 | AIChatPanel.tsx 拆分 | `ConversationList` 和 `EmptyHome` 已拆为独立文件 | P2 | ✅ 完成 |
| 1.3 | Agent 后端测试 | 5 个测试文件（tools / document-read / context-compression / stream / rate-limiter），59 个用例覆盖全部核心路径 | P1 | ✅ 完成 |
| 1.4 | 前端 AI 组件测试 | `components/ai-chat/` 下 0 个测试文件，MarkdownRenderer/MessageList/useAIChat 核心路径需测试 | P2 | ❌ 未做 |
| 1.5 | 错误边界 | `AIChatErrorBoundary` 已实现 | P1 | ✅ 完成 |
| 1.6 | 类型安全 | `runAgentStream` → `AgentStreamOptions`，`streamModelResponse` → `StreamModelOptions`，所有长参数列表已重构为 options 对象 | P2 | ✅ 完成 |

### 6.2 AI 能力持续集成

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 2.1 | Spec 模式 | LLM 先输出结构化规格说明（JSON Schema），用户确认后再执行 | P1 | ❌ 未做 |
| 2.2 | Plan 模式 | LLM 先输出执行计划（多步骤），逐步执行并展示进度 | P1 | ❌ 未做 |
| 2.3 | MCP 接入 | 通过 DashScope Responses API 接入百炼托管 MCP 服务 | P2 | ❌ 未做 |
| 2.4 | Tool 结果缓存 | 相同 query 5 分钟内复用 tool result，LRU 缓存 | P2 | ❌ 未做 |
| 2.5 | 对话上下文压缩 | `context-compression.ts` 已实现，长对话 token 超限时自动压缩历史消息 | P1 | ✅ 完成 |
| 2.6 | 流式重试 | 网络中断时支持断点续传或自动重试 | P2 | ❌ 未做 |

### 6.3 工程化补齐

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 3.1 | AI 模块 E2E 测试 | Playwright mock API 测试完整对话流程 | P2 | ❌ 未做 |
| 3.2 | Agent 性能监控 | Sentry 追踪 tool 执行耗时/LLM 响应延迟/ReAct 迭代次数 | P1 | ❌ 未做 |
| 3.3 | 环境变量校验 | `instrumentation.ts` 启动时校验 LLM_API_KEY / NEXT_PUBLIC_CONVEX_URL（必需）和 SERPAPI_API_KEY / CLERK_*（可选），缺失时立即报错 | P2 | ✅ 完成 |
| 3.4 | API Rate Limiting | 纯内存滑动窗口限流（20 次/分钟/用户），零外部依赖 | P1 | ✅ 完成 |
| 3.5 | Storybook 组件文档 | AI Chat 组件可视化文档和交互示例 | P3 | ❌ 未做 |
| 3.6 | CI 集成 AI 测试 | GitHub Actions lint-typecheck.yml 的 unit-test job 已包含 `pnpm --filter @notion/web test`，59 个 AI 用例纳入 CI | P2 | ✅ 完成 |

### 6.4 建议优先级排序

1. **2.1 Spec 模式** — AI 能力升级的下一个里程碑
2. **2.4 Tool 结果缓存** — 减少重复 tool 调用，提升响应速度和降低 API 成本
3. **3.2 Agent 性能监控** — 上线后可观测性关键
4. **1.4 前端 AI 组件测试** — 核心路径无测试
5. **2.2 Plan 模式** — 与 Spec 模式互补
6. **2.6 流式重试** — 网络不稳定场景体验
7. **3.1 AI 模块 E2E 测试** — 全链路验证
8. **3.5 Storybook 组件文档** — 文档化

---

## DashScope 兼容性备忘

| 场景 | 处理方式 |
|---|---|
| `enable_thinking` + `tool_choice` | `tool_choice` 始终为 `"auto"`，不传 `object`/`required`，规避 400 错误 |
| 多 tool_calls | DashScope 支持单轮返回多个 tool_calls，ReAct 循环并行执行后统一加入 messages |
| thinking mode 首轮 | 不需要特殊处理，LLM 在 thinking 模式下可以正常返回 tool_calls |

---

## Phase 7：Agent 能力重启（M17 候选）

### 7.0 当前基线

| 模块 | 当前状态 | 主要缺口 |
|---|---|---|
| Agent Loop | M14 已完成 ReAct 循环，LLM 自主 tool calling，最多 5 轮 | 缺少 tool 选择可观测性、tool 失败降级策略和更完整的 tool 生态 |
| Tools | 仅有 `knowledge_search`、`web_search`、`document_read` | 缺少文档写入、文档结构化操作、网页提取、任务/计划、记忆读写等工具 |
| Memory | 只有会话上下文、当前文档上下文、长上下文压缩 | 缺少长期记忆、用户偏好、项目事实、跨会话记忆检索 |
| RAG | Qdrant 向量检索 + 阈值过滤 + documentId 去重 | 缺少 query rewrite、多路召回、重排、上下文组装、引用质量评估 |
| Harness | 尚未系统化 | 可后置，但需要预留 Agent eval / regression harness 的数据结构和事件日志 |

### 7.1 更多更丰富的 Tool

| 优先级 | Tool/能力 | 目标 | 建议落点 |
|---|---|---|---|
| P0 | `document_write` / `document_update` | 让 Web Agent 能安全创建、追加、替换当前文档内容，写操作默认需要确认 | `apps/web/src/lib/agent/tools/` + Convex 文档 mutation |
| P0 | `memory_read` / `memory_write` | Agent 可读取长期记忆，也可在用户确认后沉淀偏好或事实 | 先在 Web Agent 接入，底层放到 `packages/ai/server` |
| P1 | `web_extract` | 给定 URL 抽取正文、标题、摘要，补足 `web_search` 只能返回搜索结果的问题 | 参考 `docs/ai-docs/tool/dashscope-web-extractor.md` |
| P1 | `document_search` | 在用户文档元数据中按标题/路径/最近编辑进行结构化搜索，不走向量 | Convex 查询 + Agent tool |
| P1 | `task_plan` | 生成多步骤计划并把计划事件流式展示，为后续 Plan 模式铺路 | Agent tool 或 Agent 内部 planner |
| P2 | MCP tool adapter | 复用现有 CLI/MCP 写文档能力，让 Agent 可通过受控 MCP 工具扩展 | `packages/my-notion-skills` / MCP server |

设计原则：

- 所有写类 tool 必须支持确认机制，默认 dry-run 或返回 `confirmationRequired`，避免 Agent 自动改数据。
- Tool schema 使用结构化 options 对象，避免长参数列表。
- Tool registry 逐步从 `apps/web` 下沉到 `packages/ai/server`，让 Web、CLI、MCP 后续能复用同一套 tool 定义。
- Tool 执行结果需要包含 `summary`、`sources`、`metadata`、`recoverable`，方便 LLM 二次推理和前端展示。

### 7.2 记忆系统

目标是把“上下文”升级为“可治理的 Memory”，至少拆成三类：

| 类型 | 内容 | 生命周期 | 存储建议 |
|---|---|---|---|
| User Preference Memory | 语言、沟通风格、技术偏好、禁忌、常用工具 | 长期 | Convex 元数据 + Qdrant embedding |
| Project / Workspace Memory | 项目架构、约束、历史决策、当前阶段目标 | 中长期 | Convex 结构化记录 + Qdrant embedding |
| Episodic Memory | 重要对话结论、用户明确要求“记住”的事实、阶段性任务状态 | 可过期 | Convex 记录 + Qdrant embedding + TTL/归档 |

MVP 切法：

1. 建立 `agentMemories` 数据模型：`userId`、`type`、`content`、`source`、`confidence`、`createdAt`、`updatedAt`、`expiresAt?`、`embeddingRef?`。
2. 新增 `memory_write` tool：只在用户明确要求“记住/以后都按这个来”或 Agent 提议并获得确认后写入。
3. 新增 `memory_read` tool：按当前用户问题检索偏好、项目事实和历史结论，结果注入 ReAct Loop。
4. 增加 Memory Review UI：允许用户查看、编辑、删除长期记忆，避免黑盒记忆污染。
5. 增加冲突处理：同类记忆冲突时保留新版本，旧版本标记 superseded，不直接硬删。

边界约束：

- 用户偏好等敏感信息不要只放向量库，必须有 Convex 结构化源记录，Qdrant 只做召回索引。
- 记忆写入必须可解释，记录来源消息和写入原因。
- 系统提示优先级高于记忆；记忆不能覆盖安全约束、权限边界和用户本轮明确指令。

### 7.3 RAG 检索策略升级

当前 `hybridSearch` 名称偏超前，本质仍是单路向量检索。建议按以下顺序增强：

| 阶段 | 策略 | 说明 |
|---|---|---|
| P0 | Query Rewrite | 用 LLM 或轻量规则生成 2-3 个检索 query：原问题、关键词版、语义扩展版 |
| P0 | Contextual Chunk | 索引时为 chunk 增加文档标题、层级标题、邻近 chunk 摘要，减少孤立片段 |
| P0 | Multi-query Vector Search | 多 query 并发向量检索，合并后按 `documentId + chunkIndex` 去重 |
| P1 | Keyword / Metadata Recall | 增加标题、标签、最近编辑、文档类型等结构化召回，弥补纯向量漏召 |
| P1 | Rerank | 对候选 chunk 做二阶段重排，可先用 LLM rerank，后续换专用 reranker |
| P1 | Context Packing | 按文档分组、相邻 chunk 合并、token budget 裁剪，保证回答上下文连贯 |
| P2 | Citation Quality | 输出引用覆盖率、命中分数、是否回答需要更多检索等质量信号 |

建议新增统一检索接口：

```typescript
interface KnowledgeRetrievalOptions {
  userId: string;
  query: string;
  topK?: number;
  strategy?: "fast" | "balanced" | "deep";
  filters?: {
    documentIds?: string[];
    tags?: string[];
    updatedAfter?: number;
  };
}
```

策略语义：

- `fast`：单 query 向量检索，适合实时聊天低延迟。
- `balanced`：query rewrite + multi-query + 去重 + 简单 rerank，作为默认策略。
- `deep`：balanced + metadata recall + LLM rerank + context packing，适合复杂研究问题。

### 7.4 Harness 机制（M18 候选，后置）

Harness 暂时不抢 M17 主线，但需要预留数据和事件：

| 能力 | 说明 |
|---|---|
| Golden Set | 固定一组 Agent 问题、期望 tool 调用、期望引用来源和答案要点 |
| Tool Trace Replay | 记录 ReAct 每轮 tool_calls、arguments、result 摘要，支持回放对比 |
| Retrieval Eval | 评估 recall@k、citation coverage、是否检索到目标文档 |
| Memory Eval | 验证用户偏好是否被正确读取、是否错误写入、是否能删除后不再生效 |
| Regression CLI | 提供 `pnpm eval:agent` 或类似命令，CI 中先跑轻量 smoke set |

---

## 建议实施顺序

1. **P0：RAG Retrieval Service 抽象** — 先把 `knowledge_search` 背后的检索策略从单一 `similaritySearch` 抽出来，形成 `retrieveKnowledge(options)`。
2. **P0：Memory 数据模型 + read/write tool** — 先实现长期记忆最小闭环，并确保写入需要确认。
3. **P0：Document write tool dry-run** — 打通 Agent 从读文档到改文档的最小能力，但默认不直接落库。
4. **P1：Web extractor + document metadata search** — 快速扩展两个高收益工具。
5. **P1：RAG balanced 策略** — query rewrite、多 query、去重、context packing。
6. **P2：Harness smoke set** — 主能力稳定后补评测与回归。

## 下一批里程碑建议

| 里程碑 | 范围 | 完成标准 |
|---|---|---|
| M17 | Agent Tools + Memory + RAG Retrieval Strategy | 新增至少 3 个 tool；Memory MVP 可读写可删除；`knowledge_search` 支持 `fast/balanced/deep` 策略 |
| M18 | Agent Harness + Eval | 固定 golden set、tool trace replay、retrieval/memory eval，并接入最小 CI smoke |
