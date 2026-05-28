# AI Chat 重构方案：剩余待办

> Phase 1-5 已在 M10-M14 全部完成，CLI / Skills / MCP Agent 写文档链路已在 M16 收口。M17 已完成 Hybrid Retrieval 主线、Memory MVP 和 Web Agent 文档写入 dry-run 闭环，`knowledge_search` 默认升级为混合检索，`memory_read` / `memory_write` / `document_write` / `document_update` 已接入 Web Agent。下一步重点从“写类 Tool 安全闭环”转向“Agent 可观测性、只读 Tool 生态补齐、Memory/RAG 质量增强”。

---

## Phase 6：体验优化 + 工程化补齐（M15+）

### 6.1 技术债清理

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 1.1 | useAIChat.ts 拆分 | 已拆为 `useAIChatState` + `useAIChatStream` + `useAIChatPersistence` + `stream-client`，主文件仅 34 行组合层 | P1 | ✅ 完成 |
| 1.2 | AIChatPanel.tsx 拆分 | `ConversationList` 和 `EmptyHome` 已拆为独立文件 | P2 | ✅ 完成 |
| 1.3 | Agent 后端测试 | 5 个测试文件（tools / document-read / context-compression / stream / rate-limiter），66 个用例覆盖全部核心路径 | P1 | ✅ 完成 |
| 1.4 | 前端 AI 组件测试 | `components/ai-chat/` 下 0 个测试文件，MarkdownRenderer/MessageList/useAIChat 核心路径需测试 | P2 | ❌ 未做 |
| 1.5 | 错误边界 | `AIChatErrorBoundary` 已实现 | P1 | ✅ 完成 |
| 1.6 | 类型安全 | `runAgentStream` → `AgentStreamOptions`，`streamModelResponse` → `StreamModelOptions`，所有长参数列表已重构为 options 对象 | P2 | ✅ 完成 |

### 6.2 AI 能力持续集成

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 2.1 | Spec 模式 | LLM 先输出结构化规格说明（JSON Schema），用户确认后再执行 | P1 | ❌ 未做 |
| 2.2 | Plan 模式 | LLM 先输出执行计划（多步骤），逐步执行并展示进度 | P1 | ❌ 未做 |
| 2.3 | MCP 接入 | 通过 DashScope Responses API 接入百炼托管 MCP 服务 | P2 | ❌ 未做 |
| 2.4 | Tool 结果缓存 | 只读 Tool 已支持跨请求 5 分钟 TTL + LRU 进程内缓存，并按 userId、toolName、规范化参数和当前文档上下文隔离；写类 Tool 不进入跨请求缓存，错误结果不缓存 | P2 | ✅ 完成 |
| 2.5 | 对话上下文压缩 | `context-compression.ts` 已实现，长对话 token 超限时自动压缩历史消息 | P1 | ✅ 完成 |
| 2.6 | 流式重试 | 网络中断时支持断点续传或自动重试 | P2 | ❌ 未做 |

### 6.3 工程化补齐

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 3.1 | AI 模块 E2E 测试 | Playwright mock API 测试完整对话流程 | P2 | ❌ 未做 |
| 3.2 | Agent 性能监控 | 已新增 `AgentTracer` 结构化事件，覆盖 run / ReAct iteration / LLM 首 chunk 与总耗时 / tool 执行耗时与错误；本地 console 可观测，后续可接 Sentry/Harness sink | P1 | ✅ 基础完成 |
| 3.3 | 环境变量校验 | `instrumentation.ts` 启动时校验 LLM_API_KEY / NEXT_PUBLIC_CONVEX_URL（必需）和 SERPAPI_API_KEY / CLERK_*（可选），缺失时立即报错 | P2 | ✅ 完成 |
| 3.4 | API Rate Limiting | 纯内存滑动窗口限流（20 次/分钟/用户），零外部依赖 | P1 | ✅ 完成 |
| 3.5 | Storybook 组件文档 | AI Chat 组件可视化文档和交互示例 | P3 | ❌ 未做 |
| 3.6 | CI 集成 AI 测试 | GitHub Actions lint-typecheck.yml 的 unit-test job 已包含 `pnpm --filter @notion/web test`，Agent 后端测试纳入 CI | P2 | ✅ 完成 |

### 6.4 建议优先级排序

1. **7.2 Memory 增强** — 显式 Qdrant 同步、embedding 状态可视化、Memory E2E / eval
2. **7.3 RAG 质量补齐** — citation quality、必要时接二阶段 rerank
3. **Agent Trace sink 增强** — 将 `AgentTracer` 接入 Sentry span / 持久化 trace，为 Harness replay 做数据源
4. **1.4 前端 AI 组件测试** — 核心路径无测试，补足 UI 回归保障
5. **2.1 Spec 模式 + 2.2 Plan 模式** — 在 Memory / Tool / Observability 稳定后再做确认流和计划流
6. **2.6 流式重试 + 3.1 AI 模块 E2E 测试 + 3.5 Storybook 组件文档** — 作为体验和工程化补齐项后置

---

## DashScope 兼容性备忘

| 场景 | 处理方式 |
|---|---|
| `enable_thinking` + `tool_choice` | `tool_choice` 始终为 `"auto"`，不传 `object`/`required`，规避 400 错误 |
| 多 tool_calls | DashScope 支持单轮返回多个 tool_calls，ReAct 循环并行执行后统一加入 messages |
| thinking mode 首轮 | 不需要特殊处理，LLM 在 thinking 模式下可以正常返回 tool_calls |

---

## Phase 7：Agent 能力重启（M17 进行中）

### 7.0 当前基线

| 模块 | 当前状态 | 主要缺口 |
|---|---|---|
| Agent Loop | M14 已完成 ReAct 循环，LLM 自主 tool calling，最多 5 轮；当前仍由 Web Agent registry 构建可用工具；请求开始前会自动注入相关长期记忆；已具备结构化 trace 和核心耗时日志；只读 Tool 已具备 5 分钟 TTL + LRU 跨请求缓存，单次运行内仍保留同名同参去重 | 缺少 Sentry/Harness trace sink、tool 失败降级策略和更完整的 tool 生态 |
| Tools | Web Agent 已有 `knowledge_search`、`web_search`、`web_extract`、`document_search`、`document_read`、`memory_read`、`memory_write`、`document_write`、`document_update`；CLI/MCP 已具备 docs search/fetch/create/update，写操作默认 dry-run | Web Agent 缺少任务/计划、MCP adapter 等更完整 tool 生态 |
| Memory | 已有 `agentMemories` 数据模型、Memory Review UI、确认式写入、语义检索 + token/recency fallback、Agent 自动注入；写入/编辑/停用后会清理 `memory_read` 缓存并显式同步 Qdrant | 缺少 embedding 状态可视化、专门的 Memory E2E / eval；Qdrant 不可用时目前仅 warning 降级，未持久化待重试状态 |
| RAG | 已新增 `retrieveKnowledge(options)`，支持 `fast` / `balanced` / `deep`；默认 `balanced` 走 semantic + keyword + metadata 三路召回和 RRF 融合，`deep` 已接入 Query Rewrite + Multi-query；`balanced` / `deep` 已接入 Context Packing，支持按文档合并相邻 chunk 和 token budget 裁剪 | 缺少 citation quality、二阶段 rerank；召回质量仍需 eval 验证 |
| Harness | 尚未系统化 | 可后置，但需要预留 Agent eval / regression harness 的数据结构和事件日志 |

### 7.1 更多更丰富的 Tool

| 优先级 | Tool/能力 | 目标 | 建议落点 | 当前状态 |
|---|---|---|---|---|
| P0 | `knowledge_search` 混合检索 | 从单一向量检索升级为 semantic / keyword / metadata 多路召回，默认 `balanced` | `packages/ai/server/retrieval/` + Web Agent tool | ✅ 已完成 |
| P0 | `memory_read` / `memory_write` | Agent 可读取长期记忆，也可在用户确认后沉淀偏好或事实 | Web Agent tool + `packages/ai/server/memory.ts` | ✅ 已完成 |
| P0 | `document_write` / `document_update` | 让 Web Agent 能安全创建、追加、替换当前文档内容，写操作默认需要确认 | `apps/web/src/lib/agent/tools/` + Convex 文档 mutation，复用 CLI/MCP dry-run 契约 | ✅ Web Agent dry-run + 前端确认落库已完成；CLI/MCP 已完成 |
| P1 | `web_extract` | 给定 URL 抽取正文、标题、摘要，补足 `web_search` 只能返回搜索结果的问题 | `apps/web/src/lib/agent/tools/web-extract.ts` | ✅ 已完成：支持 URL 校验、私网拦截、超时、HTML 清洗和长度裁剪 |
| P1 | `document_search` | 在用户文档元数据中按标题/路径/最近编辑进行结构化搜索，不走向量 | Convex 查询 + Agent tool；可复用 CLI/MCP docs search 语义 | ✅ Web Agent 已完成；CLI/MCP 已完成 |
| P1 | `task_plan` | 生成多步骤计划并把计划事件流式展示，为后续 Plan 模式铺路 | Agent tool 或 Agent 内部 planner | ❌ 未做 |
| P2 | MCP tool adapter | 复用现有 CLI/MCP 写文档能力，让 Agent 可通过受控 MCP 工具扩展 | `packages/my-notion-skills` / MCP server / Web Agent adapter | ⏳ CLI/MCP server 已有，Web Agent adapter 未做 |

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

1. ✅ 建立 `agentMemories` 数据模型：`userId`、`type`、`content`、`source`、`confidence`、`createdAt`、`updatedAt`、`expiresAt?`、`embeddingRef?`、`status`、`supersededBy`。
2. ✅ 新增 `memory_write` tool：默认 dry-run 并返回 `confirmationRequired`，前端确认后才写入。
3. ✅ 新增 `memory_read` tool：按当前用户问题检索偏好、项目事实和历史结论，并支持语义召回失败后的 token / recency fallback。
4. ✅ 增加 Memory Review UI：允许用户查看、筛选、新增、编辑、停用长期记忆，避免黑盒记忆污染。
5. ✅ 基础冲突处理：同类记忆冲突时保留新版本，旧版本标记 `superseded`，不直接硬删。
6. ✅ 写入/编辑/停用后显式同步 Qdrant，并清理当前用户 `memory_read` 跨请求缓存；Qdrant 不可用时不阻断 Convex 源记录写入。
7. ⚠️ 剩余增强：展示 embedding 同步状态、补 Memory E2E / eval，必要时增加失败重试队列。

边界约束：

- 用户偏好等敏感信息不要只放向量库，必须有 Convex 结构化源记录，Qdrant 只做召回索引。
- 记忆写入必须可解释，记录来源消息和写入原因。
- 系统提示优先级高于记忆；记忆不能覆盖安全约束、权限边界和用户本轮明确指令。

### 7.3 RAG 混合检索策略升级

当前 `knowledge_search` 已接入 `retrieveKnowledge(options)`，默认 `balanced` 不再是单路向量检索，而是“语义向量 + 关键词 + metadata 召回 + RRF 融合排序”的混合搜索链路。`deep` 策略已增加 Query Rewrite 和 Multi-query Search。

核心原则：

- 语义向量检索解决“表达不同但语义相近”的问题。
- 关键词检索解决 API 名称、函数名、错误码、标题、精确短语等向量检索不稳定的问题。
- Metadata 召回解决最近编辑、文档类型、当前工作区、当前文档邻近上下文等结构化过滤与补召回问题。
- 融合排序先采用 RRF 或加权分数，后续再接专用 reranker 或 LLM rerank。

建议按以下顺序增强：

| 阶段 | 策略 | 说明 |
|---|---|---|
| P0 | Hybrid Retrieval Service | ✅ 已完成：新增统一 `retrieveKnowledge(options)`，聚合 semantic / keyword / metadata 多路召回 |
| P0 | Semantic Recall | ✅ 已完成：保留 Qdrant embedding 检索，作为 `fast` 策略和混合检索语义通道 |
| P0 | Keyword Recall | ✅ 已完成：对标题、chunk 文本、标签、路径做轻量 token match 召回 |
| P0 | Fusion & Dedup | ✅ 已完成：按 `documentId + chunkIndex` 去重，使用 RRF 融合不同召回来源 |
| P0 | Contextual Chunk | ✅ 已完成基础版：索引元数据已补充标题、标签、路径、层级标题、邻近摘要等字段 |
| P1 | Query Rewrite | ✅ 已完成：`deep` 策略生成原问题、关键词版、语义扩展版 query |
| P1 | Multi-query Search | ✅ 已完成：`deep` 策略多 query 并发执行 semantic / keyword / metadata 召回 |
| P1 | Metadata Recall | ✅ 已完成基础版：支持最近编辑、标签、路径、当前文档邻近信息等结构化补召回 |
| P1 | Rerank | ❌ 未做：候选 chunk 二阶段重排仍未接入 |
| P1 | Context Packing | ✅ 已完成：`context-packing.ts` 按文档分组合并相邻 chunk，并按 `contextTokenBudget` / 默认预算裁剪上下文 |
| P2 | Citation Quality | ⚠️ 基础 `sources` 字段已有；尚未输出引用覆盖率、命中分数解释和是否需要更多检索等质量信号 |

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

interface RetrievalResultItem {
  documentId: string;
  chunkId: string;
  title: string;
  content: string;
  score: number;
  sources: Array<"semantic" | "keyword" | "metadata">;
  metadata: Record<string, unknown>;
}
```

策略语义：

- `fast`：单 query 向量检索，适合实时聊天低延迟。
- `balanced`：默认策略，执行 semantic recall + keyword recall + metadata recall + fusion/dedup，必要时做轻量 context packing。
- `deep`：在 `balanced` 基础上增加 query rewrite、multi-query search、LLM/reranker 重排和更完整的 context packing，适合复杂研究问题。

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

1. **P1：Memory 增强收尾** — 补 embedding 状态可视化、失败重试队列和 Memory E2E / eval。
2. **P1：RAG 质量补齐** — 增加 citation quality，必要时再接二阶段 rerank。
3. **P1：Agent Trace sink 增强** — 将当前结构化 trace 接入 Sentry span 或持久化事件表，支撑 Tool Trace Replay。
4. **P2：Plan/Spec 模式与 Harness smoke set** — 主能力稳定后补计划/规格确认流、golden set、tool trace replay 和最小 CI smoke。
5. **P2：task_plan / MCP adapter** — 扩展计划工具和受控外部工具适配，作为 M18 前置探索。

## 下一批里程碑建议

| 里程碑 | 范围 | 完成标准 |
|---|---|---|
| M17 | Agent Tools + Memory + Hybrid RAG Retrieval Strategy | ✅ 主线完成：`knowledge_search` 已支持 `fast/balanced/deep` 且默认 `balanced`；Memory MVP 已完成可读、确认式写入、Review UI 和停用；Web Agent 文档写入 dry-run + 前端确认落库已完成；Agent 基础性能 trace 已完成；`web_extract` / `document_search` 已完成 |
| M18 | Agent Harness + Eval | 固定 golden set、tool trace replay、retrieval/memory eval，并接入最小 CI smoke |
