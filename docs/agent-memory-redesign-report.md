# My-Notion Agent 记忆机制分析与重构设计报告

## 1. 背景与结论摘要

My-Notion 当前已经具备 Memory MVP：Agent 可以读取长期记忆、提出记忆写入预览，用户可以在 Tool 卡片中确认保存，也可以在 `/memories` 页面集中查看、编辑和停用记忆。

但从产品化 Agent 架构看，当前机制仍然偏“可用的记忆列表”，还不是一个稳定、可治理、可评估的 Agent Memory System。核心问题不是没有 Memory，而是缺少：

- 分层：没有区分指令记忆、语义记忆、情节记忆、过程记忆。
- 作用域：没有 user/project/workspace/document/conversation/module/path 等隔离。
- 治理：缺少 pending review、去重合并、冲突检测、衰减、过期、保鲜。
- 证据：缺少 source message、conversation、document、tool call、原始片段引用。
- 可观测：缺少 embedding 同步状态、失败重试、使用次数、召回命中指标。
- 前端心智：页面目前是 CRUD 列表，不是“Agent 为什么知道、是否可信、是否还有效”的 Memory Center。

建议目标不是简单增强现有 `memory_read` / `memory_write`，而是把 Memory 重构为：

```text
Instruction Memory  # 稳定规则、用户偏好、项目约束，类似 Claude Code 的 CLAUDE.md / AGENTS.md
Semantic Memory     # 长期事实、实体、偏好、项目知识
Episodic Memory     # 会话事件、关键决策、工具调用结果、任务过程
Procedural Memory   # Agent 工作流、工具使用经验、成功/失败模式
```

运行时采用三层上下文策略：

```text
Always-on compact context      # 少量高优先级规则和偏好
Selective retrieved context    # 按 query/scope/mode/tool 精准召回
Tool-accessible deep memory    # 需要时通过 memory_search 深查
```

前端应从 `MemoryReviewPage` 升级为 `Memory Center`：

- `Overview`：总体健康度和待处理事项。
- `Inbox`：Agent 提议的待审核记忆。
- `Active Memories`：已生效记忆，支持搜索、过滤、编辑。
- `Conflicts`：重复/冲突记忆治理。
- `Settings`：自动记忆、隐私、确认策略、作用域设置。
- `Detail Drawer`：证据链、修改历史、同步状态、使用记录。

本报告给出可执行重构规格，后续可拆为 M21/M22 或独立 Memory 里程碑实施。

## 2. 当前实现总览

### 2.1 数据模型

当前 Memory 表定义在：

- `packages/convex/schemas/agentMemories.ts`

现有字段：

| 字段             | 当前含义                                   | 问题                                        | <br />     | <br />                                            |
| -------------- | -------------------------------------- | ----------------------------------------- | :--------- | :------------------------------------------------ |
| `userId`       | Clerk userId / Convex identity subject | 只有用户作用域，没有项目、文档、会话、工作区等 scope             | <br />     | <br />                                            |
| `type`         | \`preference                           | project                                   | episodic\` | 过粗，不能表达规则、工作流、事实、会话事件、工具经验                        |
| `content`      | 可审查正文                                  | 没有 summary、source quote、结构化实体             | <br />     | <br />                                            |
| `source`       | \`user\_explicit                       | agent\_proposed                           | manual\`   | 只能表达来源类型，不能定位来源证据                                 |
| `reason`       | 写入原因                                   | 不是证据链，无法回溯原始上下文                           | <br />     | <br />                                            |
| `confidence`   | 0-1 置信度                                | 没有 importance、stability、usage、reviewDueAt | <br />     | <br />                                            |
| `status`       | \`active                               | superseded                                | deleted\`  | 缺少 `pending_review`、`rejected`、`archived`、`stale` |
| `supersededBy` | 被哪条新记忆取代                               | 只能单向记录，缺少批量合并和冲突关系                        | <br />     | <br />                                            |
| `expiresAt`    | 可选过期时间                                 | UI 不可编辑，也没有保鲜提醒                           | <br />     | <br />                                            |
| `embeddingRef` | 后续向量索引用                                | 实际未形成 sync 状态闭环                           | <br />     | <br />                                            |

相关 Convex 逻辑：

- `packages/convex/agentMemories/logic/create.ts`
- `packages/convex/agentMemories/logic/list.ts`
- `packages/convex/agentMemories/logic/update.ts`
- `packages/convex/agentMemories/logic/deactivate.ts`

### 2.2 Agent 工具链路

当前工具定义在：

- `apps/web/src/lib/agent/tools/definitions.ts`
- `apps/web/src/lib/agent/tools/memory.ts`

当前工具：

| Tool           | 当前行为                         | 风险                                             |
| -------------- | ---------------------------- | ---------------------------------------------- |
| `memory_read`  | 读取长期记忆，支持 `query/type/limit` | 与启动前自动注入重复，缺少 scope/kind/category              |
| `memory_write` | 默认 dry-run，确认后写入             | 写入目标直接是 active memory，缺少 pending review 与系统级治理 |

`memory_read` 当前流程：

```text
Agent 调用 memory_read
  -> Convex 查询 active memories，最多 100 条
  -> retrieveRelevantMemories
  -> Qdrant 语义召回或 fallback token/recency
  -> 返回 memories
```

`memory_write` 当前流程：

```text
Agent 调用 memory_write
  -> 默认 dryRun=true，返回 confirmationRequired
  -> ToolCallCard 中用户点击保存
  -> createAgentMemory mutation
  -> syncMemoryIndex 调用 /api/agent/memories/sync
  -> updateToolResultState 持久化 Tool 卡片状态
```

### 2.3 自动注入链路

当前自动注入在：

- `apps/web/src/app/api/agent/stream/route.ts`

每次 Agent 请求会：

```text
extractLatestUserText(messages)
  -> buildMemoryContext({ query: latestUserText })
  -> Convex listAgentMemories({ limit: 100 })
  -> retrieveRelevantMemories({ topK: 6 })
  -> 注入 system message
```

注入文本格式：

```text
Relevant long-term memories for this user:
1. [preference] ...
2. [project] ...
Use these memories as soft context. The current user instruction always has higher priority.
```

这个设计能快速让 Memory 生效，但缺少：

- token budget
- scope match
- kind/category priority
- stale penalty
- source/citation
- sensitive memory 控制
- instruction 与 retrieved memory 的优先级分离

### 2.4 向量同步链路

相关文件：

- `packages/ai/server/memory.ts`
- `packages/ai/rag/qdrantVectorStore.ts`
- `apps/web/src/app/api/agent/memories/sync/route.ts`
- `apps/web/src/lib/agent/memory-sync-client.ts`

当前向量同步存在两条路径：

```text
写路径：
create/update/delete memory
  -> /api/agent/memories/sync
  -> syncAgentMemory / deleteAgentMemoryIndex
  -> Qdrant upsert/delete
```

```text
读路径：
retrieveRelevantMemories
  -> activeMemories.map(upsertAgentMemory)
  -> semanticSearchAgentMemories
```

读路径执行 upsert 是明显的架构异味。读取应该是无副作用操作，向量索引同步应由写路径、后台任务或重试队列负责。

### 2.5 前端页面

当前页面：

- `apps/web/src/components/ai-chat/MemoryReviewPage.tsx`
- `apps/web/src/app/[locale]/(main)/(routes)/memories/page.tsx`

当前能力：

- 搜索
- 类型筛选
- 新建
- 编辑
- 停用
- 删除确认弹窗

当前 Tool 卡片：

- `apps/web/src/components/ai-chat/ToolCallCard.tsx`

`memory_write` 预览卡片支持：

- 保存记忆
- 取消记忆
- 保存后更新 message tool result 状态

问题是：页面和卡片都只解决了“保存/编辑一条记忆”，还没有解决“记忆系统是否健康、是否可信、是否过期、是否冲突、是否被 Agent 正确使用”。

## 3. 对标 Claude Code 与主流 Agent Memory

### 3.1 Claude Code 的关键启发

Claude Code 官方 Memory 机制提供两类能力：

- `CLAUDE.md` / `AGENTS.md` 等文件型记忆：用于稳定、可审查、可版本化的项目指令。
- Auto memory：自动积累 build commands、debugging insights、architecture notes、code style preferences、workflow habits 等经验。

官方文档强调：

- Memory 有层级：组织级、用户级、项目级、子目录级。
- `CLAUDE.md` 适合稳定规则、架构、命令、约束和 gotchas。
- `/memory` 用于查看和编辑记忆。
- Auto memory 不是每轮都保存，而是判断未来是否有价值。
- 文件型 Memory 会被加载进上下文，因此必须短、具体、稳定。

参考：

- [How Claude remembers your project](https://code.claude.com/docs/en/memory/)
- [Give Claude context: CLAUDE.md and better prompts](https://support.claude.com/en/articles/14553240-give-claude-context-claude-md-and-better-prompts)

My-Notion 不需要完全复制 Claude Code，因为 My-Notion 是文档/知识库产品，不是纯编码 Agent。但 Claude Code 的分层思想非常适合借鉴：

```text
稳定规则：常驻上下文，短而强约束
动态经验：自动积累，但可审查
深层记忆：需要时检索，不默认全部注入
管理入口：用户能看见、编辑、删除、追踪
```

### 3.2 主流 Agent Memory 的共同模型

主流 Agent Memory 通常至少区分：

| 类型                | 作用               | 示例                  |
| ----------------- | ---------------- | ------------------- |
| Working Memory    | 当前上下文窗口内可直接推理的信息 | 当前消息、工具结果、当前文档      |
| Episodic Memory   | 发生过什么            | 会话摘要、工具调用、用户反馈、任务过程 |
| Semantic Memory   | 已知事实             | 用户偏好、项目事实、实体关系      |
| Procedural Memory | 怎么做事             | 工作流、工具使用经验、成功/失败模式  |

生产系统还会引入：

- memory consolidation：把大量 episodic memory 提炼为 semantic memory。
- forgetting / decay：低价值或过期内容降权。
- deduplication：去重与合并。
- provenance：来源证据。
- evaluation：召回质量与误用率评估。
- observability：同步状态、命中记录、用户反馈。

参考：

- [Agent Memory Optimization](https://www.artificial-intelligence-wiki.com/agentic-ai/agent-architectures-and-components/agent-memory-optimization/)
- [AI Agent Memory Architecture](https://inductivee.com/blog/ai-agent-memory-persistence-architecture)
- [AI agent memory with managed memory](https://www.elastic.co/search-labs/blog/ai-agent-memory-management-elasticsearch)

## 4. 当前问题清单

### P0：会影响 Agent 正确性的结构问题

#### 4.1 记忆类型过粗

当前 `type = preference | project | episodic` 只能粗略表达三类内容。

但真实 Agent 需要区分：

- 用户偏好：沟通语言、输出风格、是否要测试。
- 项目规则：技术栈、目录边界、不可违反约束。
- 工作流：发布流程、验证命令、安全链路。
- 项目事实：当前版本、已完成里程碑。
- 决策记录：为什么移除 Spec 模式，为什么使用 Device Flow。
- 工具经验：某命令需要先启动 Qdrant，某 API 用 `.site` URL。
- 会话事件：某次问题如何排查、用户反馈是什么。

这些内容的生命周期、作用域、召回方式完全不同，不能都放在一个 `type` 下。

#### 4.2 缺少作用域层级

当前 Memory 只有 `userId`。

这会导致：

- 项目 A 的偏好污染项目 B。
- 文档级上下文被误用于全局回答。
- 临时会话结论被当成长期规则。
- Mobile/Web/CLI 不同端的约束混杂。
- 未来多人协作或团队空间无法扩展。

建议引入：

```ts
type MemoryScope =
  | { level: "user"; key: string }
  | { level: "workspace"; key: string }
  | { level: "project"; key: string }
  | { level: "document"; key: string }
  | { level: "conversation"; key: string }
  | { level: "module"; key: string }
  | { level: "path"; key: string };
```

#### 4.3 自动注入策略过粗

当前每次请求自动注入最多 6 条相关记忆。

问题：

- 没有区分 instruction memory 和 retrieved memory。
- 没有 token budget，未来记忆变长会污染 system prompt。
- 没有 source/citation，模型无法解释“为什么知道”。
- 没有稳定性和过期控制。
- 没有敏感信息策略。
- 没有 scope match，跨场景误召回风险高。

更合理的策略是：

```text
system prompt
  -> always-on compact instruction memory
  -> current task context
  -> selective retrieved memory
  -> tool-accessible deep memory
```

#### 4.4 读路径存在副作用

`retrieveRelevantMemories` 当前会在查询时执行：

```ts
await Promise.all(
  activeMemories.map((memory) => vectorStore.upsertAgentMemory(options.userId, memory)),
);
```

这会带来：

- 读请求变慢。
- Qdrant 故障影响读取延迟。
- 同步错误不透明。
- 难以统计真实 embedding 状态。
- 并发请求重复 upsert。

读路径必须纯读。索引同步应该迁到写路径、队列或后台任务。

### P1：会影响可治理性的产品问题

#### 4.5 写入确认缺少统一 Inbox

当前用户只能在 Tool 卡片里确认保存。这个设计适合当前对话的单条快速确认，但不适合长期治理。

问题：

- 用户错过卡片后难以集中处理。
- Agent 自动提议的多条记忆无法批量审核。
- 没有“编辑后接受”“合并到已有记忆”“标记为不再提示”。
- 没有 pending 状态和审核队列。

应引入 Memory Inbox：

```text
Agent proposal
  -> pending_review
  -> Inbox
  -> accept / edit and accept / merge / reject / archive
```

#### 4.6 缺少证据链

当前 `reason` 是自由文本，不足以作为证据。

应记录：

- `conversationId`
- `messageId`
- `toolCallId`
- `documentId`
- `sourceText`
- `sourceUrl`
- `createdFrom`
- `modelId`

有了证据链，前端才能回答：

- 这条记忆从哪里来？
- 是用户明确说的，还是 Agent 推断的？
- 是否来自某篇文档？
- 当时上下文是什么？
- 如果 Agent 记错了，如何追责和修正？

#### 4.7 缺少去重、合并、冲突治理

当前只有 `supersedesMemoryId`，而且依赖模型传参。

应由系统主动检测：

- 近似重复：内容相似、scope 相同、kind/category 相同。
- 软冲突：新旧偏好不一致。
- 硬冲突：安全约束相反。
- 过期覆盖：新事实替代旧事实。

建议引入：

```ts
type MemoryRelation = {
  type: "duplicates" | "supersedes" | "conflicts_with" | "supports";
  targetMemoryId: Id<"agentMemories">;
  score?: number;
  reason?: string;
};
```

#### 4.8 缺少保鲜、衰减与使用反馈

Memory 不是越多越好。没有保鲜机制会导致 context rot。

建议字段：

- `importance`
- `stability`
- `reviewDueAt`
- `lastUsedAt`
- `usageCount`
- `lastUsedConversationId`
- `userFeedback`: `helpful | wrong | outdated | irrelevant`

召回时应对 stale memory 降权，而不是只按语义分数。

### P2：会影响体验和运维的问题

#### 4.9 前端页面是 CRUD，不是 Memory Center

当前 `/memories` 页面主要展示列表和表单。

缺少：

- 总览指标
- 待审核队列
- 冲突治理
- 同步失败提示
- 来源证据
- 修改历史
- 自动记忆设置
- 隐私控制
- scope/category/kind 过滤

用户看到的是“AI 保存了哪些文本”，而不是“AI 现在基于哪些可控知识在行动”。

#### 4.10 同步不可观测

当前 Qdrant 不可用时只返回 warning 或 console.warn。

应持久化：

- `embeddingStatus`
- `embeddingUpdatedAt`
- `embeddingError`
- `embeddingRetryCount`
- `nextRetryAt`

前端应该展示：

- 已同步
- 待同步
- 同步失败
- 不需要同步

#### 4.11 缺少评估体系

当前测试只覆盖工具的基础行为，没有 Memory 质量评估。

需要新增：

- retrieval eval：给定 query 是否召回正确 memory。
- write eval：模型提议记忆是否应该保存。
- conflict eval：相似/冲突记忆是否识别正确。
- prompt injection eval：恶意文档是否能污染长期记忆。
- UI tests：Inbox、accept、reject、merge、sync status。

## 5. 目标架构

### 5.1 Memory 分层

```text
Memory System
├── Instruction Memory
│   ├── 用户偏好
│   ├── 项目规则
│   ├── 安全约束
│   └── 输出风格
├── Semantic Memory
│   ├── 项目事实
│   ├── 实体关系
│   ├── 长期偏好
│   └── 稳定知识
├── Episodic Memory
│   ├── 会话摘要
│   ├── 工具调用结果
│   ├── 关键决策
│   └── 任务状态
└── Procedural Memory
    ├── 工作流模板
    ├── 工具使用经验
    ├── 成功模式
    └── 失败教训
```

### 5.2 运行时上下文策略

```text
Agent request
  -> resolve scope
  -> load compact instruction memory
  -> build current task context
  -> optionally retrieve semantic/episodic/procedural memory
  -> run ReAct loop
  -> produce response/tool calls
  -> propose memory writes
  -> user review / inbox
```

建议约束：

- Instruction Memory 可自动注入，但必须短、稳定、高优先级。
- Semantic/Episodic Memory 默认不直接注入 system prompt，除非召回分数和 scope 足够强。
- Procedural Memory 优先影响 tool choice / plan mode，而不是直接作为事实回答。
- 所有自动注入内容都要可追踪：在 trace 中记录 memory ids。

### 5.3 召回排序公式

建议检索排序不只看向量分数：

```text
finalScore =
  semanticScore * 0.40
  + scopeScore * 0.20
  + importance * 0.15
  + confidence * 0.10
  + recencyScore * 0.05
  + usageScore * 0.05
  - stalenessPenalty * 0.10
  - privacyPenalty
```

其中：

- `scopeScore`：当前项目/文档/会话匹配程度。
- `importance`：人工或系统设定重要性。
- `confidence`：可信度。
- `recencyScore`：短期任务或 episodic memory 有用。
- `usageScore`：过去被证明有用的记忆略微加权。
- `stalenessPenalty`：长期未审查或已过期降权。
- `privacyPenalty`：敏感记忆默认不注入，只能 tool 查询并受权限控制。

## 6. 数据模型重构规格

### 6.1 建议字段

在现有 `agentMemories` 上兼容演进，优先新增可选字段：

```ts
type MemoryKind = "instruction" | "semantic" | "episodic" | "procedural";

type MemoryStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "superseded"
  | "archived"
  | "rejected"
  | "deleted";

type MemoryStability = "stable" | "evolving" | "temporary";
type MemoryPrivacy = "normal" | "sensitive";
type MemoryEmbeddingStatus = "pending" | "synced" | "failed" | "skipped";

type MemoryScopeLevel =
  | "user"
  | "workspace"
  | "project"
  | "document"
  | "conversation"
  | "module"
  | "path";
```

建议 schema：

```ts
{
  userId: v.string(),

  // Backward compatibility
  type: v.optional(v.union(
    v.literal("preference"),
    v.literal("project"),
    v.literal("episodic"),
  )),

  kind: v.union(
    v.literal("instruction"),
    v.literal("semantic"),
    v.literal("episodic"),
    v.literal("procedural"),
  ),
  category: v.string(),

  scopeLevel: v.union(
    v.literal("user"),
    v.literal("workspace"),
    v.literal("project"),
    v.literal("document"),
    v.literal("conversation"),
    v.literal("module"),
    v.literal("path"),
  ),
  scopeKey: v.string(),

  content: v.string(),
  summary: v.optional(v.string()),
  tags: v.optional(v.array(v.string())),

  source: v.union(
    v.literal("user_explicit"),
    v.literal("agent_proposed"),
    v.literal("auto_extracted"),
    v.literal("manual"),
    v.literal("system"),
  ),
  createdBy: v.union(v.literal("user"), v.literal("agent"), v.literal("system")),

  evidenceConversationId: v.optional(v.id("aiConversations")),
  evidenceMessageId: v.optional(v.id("aiMessages")),
  evidenceDocumentId: v.optional(v.id("documents")),
  evidenceToolCallId: v.optional(v.string()),
  evidenceText: v.optional(v.string()),
  evidenceUrl: v.optional(v.string()),

  confidence: v.number(),
  importance: v.number(),
  stability: v.union(v.literal("stable"), v.literal("evolving"), v.literal("temporary")),
  privacy: v.union(v.literal("normal"), v.literal("sensitive")),

  status: v.union(
    v.literal("draft"),
    v.literal("pending_review"),
    v.literal("active"),
    v.literal("superseded"),
    v.literal("archived"),
    v.literal("rejected"),
    v.literal("deleted"),
  ),

  expiresAt: v.optional(v.number()),
  reviewDueAt: v.optional(v.number()),
  lastUsedAt: v.optional(v.number()),
  usageCount: v.optional(v.number()),

  embeddingStatus: v.union(
    v.literal("pending"),
    v.literal("synced"),
    v.literal("failed"),
    v.literal("skipped"),
  ),
  embeddingUpdatedAt: v.optional(v.number()),
  embeddingError: v.optional(v.string()),
  embeddingRetryCount: v.optional(v.number()),
  nextEmbeddingRetryAt: v.optional(v.number()),

  supersededBy: v.optional(v.id("agentMemories")),
  supersedes: v.optional(v.array(v.id("agentMemories"))),
  conflictsWith: v.optional(v.array(v.id("agentMemories"))),

  createdAt: v.number(),
  updatedAt: v.number(),
}
```

### 6.2 建议索引

```ts
.index("by_user_status", ["userId", "status"])
.index("by_user_kind_status", ["userId", "kind", "status"])
.index("by_user_scope_status", ["userId", "scopeLevel", "scopeKey", "status"])
.index("by_user_embedding_status", ["userId", "embeddingStatus"])
.index("by_user_review_due", ["userId", "reviewDueAt"])
.index("by_user_updated_at", ["userId", "updatedAt"])
```

### 6.3 类型映射

旧字段迁移规则：

| 旧 `type`     | 默认新 `kind`    | 默认 `category`     | 备注                                     |
| ------------ | ------------- | ----------------- | -------------------------------------- |
| `preference` | `instruction` | `user_preference` | 若内容是事实而非规则，可人工调整为 semantic             |
| `project`    | `semantic`    | `project_fact`    | 若内容是硬约束，可调整为 instruction/project\_rule |
| `episodic`   | `episodic`    | `session_note`    | 默认 temporary/evolving                  |

## 7. Agent 读写链路重构规格

### 7.1 工具拆分

当前 `memory_read` / `memory_write` 建议演进为：

| Tool                     | 类型   | 作用                               |
| ------------------------ | ---- | -------------------------------- |
| `memory_search`          | 只读   | 按 query/scope/kind/category 检索记忆 |
| `memory_propose`         | 写入提案 | 生成 pending review，不直接 active     |
| `memory_update_proposal` | 更新提案 | 提议合并、替换、过期、降权                    |
| `memory_commit`          | 提交   | 仅用户确认路径或服务端授权路径可执行               |

兼容策略：

- `memory_read` 保留为 `memory_search` alias 一段时间。
- `memory_write` 保留 dry-run 行为，但内部改成 `memory_propose`。
- 真实写入不再由模型直接设置 `dryRun=false`，而由前端确认或服务端 mutation 执行。

### 7.2 写入策略

#### 用户明确要求记住

触发条件：

- “记住”
- “以后都按这个”
- “以后默认”
- “把这个作为项目规则”

流程：

```text
memory_propose
  -> kind/category/scope classification
  -> conflict detection
  -> Tool card quick confirm
  -> 同步进入 Inbox
  -> user commit
  -> active
  -> embeddingStatus=pending
```

#### Agent 自动发现

触发条件：

- 用户没有明确要求记住，但对未来有价值。
- 例如重复偏好、稳定项目约束、重要踩坑。

流程：

```text
auto extractor
  -> memory_propose
  -> status=pending_review
  -> Inbox
  -> 不打断当前回答
```

默认不应在当前回答里强行展示保存按钮，避免打扰。

#### 人工页面新建

流程：

```text
Memory Center -> New Memory
  -> active
  -> embeddingStatus=pending
  -> sync worker
```

### 7.3 读取策略

请求开始：

```text
resolveScope(request)
loadInstructionMemory(scope, budget)
buildSystemMessage()
```

ReAct 过程中：

```text
LLM 判断是否需要历史偏好/事实
  -> memory_search
  -> selective retrieved context
  -> final answer
```

`memory_search` 参数建议：

```ts
{
  query: string;
  kinds?: MemoryKind[];
  categories?: string[];
  scopes?: Array<{ level: MemoryScopeLevel; key: string }>;
  limit?: number;
  includeSensitive?: boolean;
  includeEvidence?: boolean;
}
```

返回结构建议：

```ts
{
  query: string;
  memories: Array<{
    id: string;
    kind: MemoryKind;
    category: string;
    scope: { level: string; key: string };
    content: string;
    summary?: string;
    confidence: number;
    importance: number;
    status: string;
    score: number;
    scoreBreakdown: {
      semantic?: number;
      scope?: number;
      importance?: number;
      confidence?: number;
      recency?: number;
      usage?: number;
      stalenessPenalty?: number;
    };
    evidence?: {
      conversationId?: string;
      messageId?: string;
      documentId?: string;
      sourceText?: string;
    };
  }>;
  metadata: {
    retrieval: "semantic" | "hybrid" | "fallback";
    unavailable?: boolean;
    error?: string;
  };
}
```

### 7.4 禁止读路径 upsert

`packages/ai/server/memory.ts` 应拆分：

```text
syncAgentMemory       # 仅写路径或 worker 调用
retrieveRelevantMemories # 只读，不 upsert
fallbackRankMemories  # fallback 排序
```

向量同步由以下路径负责：

- 创建/更新 memory 后设置 `embeddingStatus=pending`。
- 后台 job 或显式 sync API 扫描 pending/failed。
- 成功后设置 `synced`。
- 失败后记录 `embeddingError`、`embeddingRetryCount`、`nextEmbeddingRetryAt`。

## 8. 前端 Memory Center 重构规格

### 8.1 页面定位

当前 `MemoryReviewPage` 应改造为：

```text
Memory Center = Agent 长期记忆控制台
```

用户进入页面应该能回答：

- Agent 现在记住了什么？
- 哪些记忆正在等待我确认？
- 哪些记忆可能冲突或重复？
- 哪些记忆已经过期或需要复查？
- 哪些记忆同步失败，可能不会被召回？
- 某条记忆来自哪里？
- Agent 最近是否使用过这条记忆？

### 8.2 页面信息架构

建议保持路由：

- `/memories`

页面内部改为 Tab：

```text
Overview | Inbox | Active | Conflicts | Settings
```

#### Overview

展示：

- active memory count
- pending review count
- sync failed count
- review due count
- sensitive memory count
- recent used count

卡片：

- “待审核记忆”
- “同步失败”
- “即将过期”
- “最近被 Agent 使用”

#### Inbox

展示 `status=pending_review`。

操作：

- Accept
- Edit and accept
- Merge into existing
- Reject
- Archive

每条 pending memory 展示：

- kind/category
- scope
- content
- proposed reason
- evidence snippet
- confidence
- conflict/duplicate hints

#### Active

替代当前列表页。

过滤器：

- kind
- category
- scope
- status
- embeddingStatus
- privacy
- updatedAt
- query

卡片展示：

- content / summary
- kind/category badge
- scope badge
- confidence / importance
- lastUsedAt / usageCount
- embeddingStatus
- evidence link

#### Conflicts

展示：

- duplicates
- conflictsWith
- stale candidates
- supersede suggestions

操作：

- Merge
- Supersede
- Keep both
- Reject suggestion

#### Settings

设置项：

- 自动记忆：off / explicit only / suggestions to inbox / auto for low-risk
- 敏感信息策略：never save / require confirm / allow manual only
- 默认作用域：user / project / document
- 自动过期策略：episodic 30/90 days
- 是否允许 Agent 在对话中打断提示保存

### 8.3 Detail Drawer

点击任意 memory 打开详情抽屉。

包含：

- 正文和 summary
- kind/category/scope
- source、createdBy
- evidence message/document/tool call
- revision history
- usage history
- embedding sync log
- related memories
- conflicts
- edit/archive/delete 操作

### 8.4 Tool 卡片改造

当前 `memory_write` 卡片不应废弃，但应降低职责：

当前对话内快速确认：

- Save
- Cancel
- Edit before save
- Send to Inbox

保存后：

- 展示 `saved`
- 展示“查看记忆详情”
- 如果同步失败，显示 warning，而不是只 console.warn

所有 Agent 提议应同时进入 Inbox，避免用户错过卡片。

## 9. 迁移方案

### Phase 0：兼容字段扩展

目标：

- 不破坏现有 `agentMemories`。
- 新增 optional 字段。
- 旧 UI 和工具仍可运行。

动作：

- schema 添加新字段。
- create/list/update 逻辑填充默认值。
- 保留旧 `type`。

### Phase 1：类型映射与 UI 兼容

目标：

- 旧数据可被新页面展示。

动作：

- `preference` 映射为 `instruction/user_preference`。
- `project` 映射为 `semantic/project_fact`。
- `episodic` 映射为 `episodic/session_note`。
- 新页面显示 derived kind/category。

### Phase 2：Pending Review 与 Inbox

目标：

- Agent 提议不直接进入 active。

动作：

- 新增 `pending_review`。
- Tool 卡片保存走 commit mutation。
- Memory Center 增加 Inbox。

### Phase 3：索引同步治理

目标：

- 移除读路径 upsert。

动作：

- 新增 embedding status 字段。
- 写路径设置 pending。
- sync API 更新状态。
- 后台重试 failed。
- `retrieveRelevantMemories` 改纯读。

### Phase 4：召回策略重构

目标：

- 引入 scope-aware retrieval。

动作：

- `memory_search` 支持 kind/category/scope。
- 排序引入 scope/importance/confidence/staleness。
- system prompt 只注入 compact instruction memory。
- trace 记录 injected memory ids 和 searched memory ids。

### Phase 5：评估与自动提取

目标：

- 自动记忆可控上线。

动作：

- 增加 memory retrieval eval fixtures。
- 增加 memory write quality eval。
- 增加 conflict detection eval。
- 支持 session end / compact 后自动提取候选记忆。
- 默认进入 Inbox，不直接 active。

## 10. 验证与评估体系

### 10.1 单元测试

建议新增/扩展：

- `apps/web/src/lib/agent/__tests__/tools.test.ts`
  - `memory_search` scope/kind/category 参数。
  - `memory_propose` 默认 pending\_review。
  - `memory_commit` 权限和状态流转。
  - 读路径不触发 upsert。
- `packages/ai/__tests__/memory-retrieval.test.ts`
  - 排序公式。
  - stale penalty。
  - scope match。
  - fallback behavior。
- `packages/convex/agentMemories` 对应 logic 测试。

### 10.2 UI 测试

建议覆盖：

- Inbox accept/reject/edit flow。
- Active filters。
- Conflict merge。
- Detail drawer evidence。
- embedding failed warning。
- Tool 卡片保存后跳转详情。

### 10.3 Eval

建议新增 fixture：

```ts
{
  query: "以后写移动端文案要注意什么？",
  expectedMemoryIds: ["..."],
  forbiddenMemoryIds: ["..."],
  scope: { level: "project", key: "mobile" },
}
```

指标：

- Recall\@K
- Precision\@K
- MRR
- wrong-scope hit rate
- stale hit rate
- sensitive leakage rate
- memory write acceptance rate
- rejected proposal rate
- duplicate proposal rate

### 10.4 运行验证

代码实现阶段至少运行：

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke
```

如果修改共享包：

```bash
pnpm test
pnpm exec vitest packages/ai
```

## 11. 分阶段实施路线

### Milestone A：Memory Schema 与兼容层

目标：

- 新字段落库。
- 旧数据兼容。
- 不改变现有用户体验。

涉及文件：

- `packages/convex/schemas/agentMemories.ts`
- `packages/convex/agentMemories/logic/create.ts`
- `packages/convex/agentMemories/logic/list.ts`
- `packages/convex/agentMemories/logic/update.ts`
- `packages/convex/agentMemories/logic/deactivate.ts`

完成标准：

- 旧 memory 可正常读取。
- 新 memory 默认有 kind/category/scope/status/embeddingStatus。

### Milestone B：Memory Search 与纯读检索

目标：

- 移除读路径 upsert。
- 新增 scope-aware retrieval。

涉及文件：

- `packages/ai/server/memory.ts`
- `packages/ai/rag/qdrantVectorStore.ts`
- `apps/web/src/lib/agent/tools/memory.ts`
- `apps/web/src/lib/agent/tools/definitions.ts`

完成标准：

- `retrieveRelevantMemories` 不写 Qdrant。
- `memory_search` 支持 scope/kind/category。
- 召回结果包含 scoreBreakdown。

### Milestone C：Memory Inbox 与确认流

目标：

- Agent 提议进入 pending\_review。
- 前端可集中审核。

涉及文件：

- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
- `apps/web/src/components/ai-chat/MemoryReviewPage.tsx`
- `packages/convex/agentMemories/logic/*`
- `packages/business/i18n/zh-CN.json`
- `packages/business/i18n/en.json`

完成标准：

- Tool 卡片可保存、取消、发送 Inbox。
- Inbox 可接受、编辑接受、拒绝。
- 已处理状态可持久化。

### Milestone D：Memory Center

目标：

- 页面从 CRUD 列表升级为控制台。

涉及文件：

- `apps/web/src/components/ai-chat/MemoryReviewPage.tsx`
- 可拆分为：
  - `MemoryCenterPage.tsx`
  - `MemoryOverview.tsx`
  - `MemoryInbox.tsx`
  - `MemoryActiveList.tsx`
  - `MemoryConflicts.tsx`
  - `MemorySettings.tsx`
  - `MemoryDetailDrawer.tsx`

完成标准：

- 支持 Overview / Inbox / Active / Conflicts / Settings。
- 展示 evidence、embeddingStatus、usage、reviewDueAt。

### Milestone E：Eval 与自动提取

目标：

- 自动记忆进入可控阶段。

涉及文件：

- `packages/ai/eval/*`
- `apps/web/src/app/api/agent/stream/route.ts`
- 可能新增 `apps/web/src/lib/agent/memory-extractor.ts`

完成标准：

- session end / compact 后可生成 pending proposals。
- 自动提取默认进入 Inbox。
- 有 retrieval/write/conflict eval。

## 12. 风险与取舍

### 12.1 不建议一次性上复杂知识图谱

当前 My-Notion 仍处于个人知识库 + Agent 产品化阶段。过早上完整 graph memory 会增加复杂度。

建议先在单表上扩展 kind/category/scope/evidence/relation，等真实使用证明需要再拆图谱表。

### 12.2 不建议自动写 active memory

自动提取很容易造成记忆污染。

建议：

- 用户明确“记住”时允许快速确认。
- Agent 自动发现只进 Inbox。
- 敏感内容默认不保存。

### 12.3 不建议把所有相关记忆塞进 system prompt

Memory 注入过多会导致 context rot。

建议：

- system prompt 只放 compact instruction memory。
- 其他记忆通过 `memory_search` 或 selective context 进入。
- trace 记录每次注入的 memory ids。

### 12.4 不建议让前端页面只做数据库编辑器

Memory 页面不是后台管理表格，而是用户对 Agent 认知边界的控制台。

页面重点应是：

- 信任
- 证据
- 控制
- 健康度
- 冲突治理

## 13. 建议优先级

最高优先级：

1. 扩展 schema：kind/category/scope/status/evidence/embeddingStatus。
2. 移除读路径 upsert。
3. 引入 pending\_review 和 Inbox。
4. 调整自动注入策略，只注入 compact instruction memory。

中优先级：

1. scope-aware retrieval。
2. scoreBreakdown。
3. sync 状态可视化。
4. conflict/duplicate detection。

后续增强：

1. 自动提取。
2. procedural memory。
3. memory eval。
4. trace replay。

## 14. 总结

My-Notion 当前 Memory MVP 已经打通了“Agent 提议 -> 用户确认 -> Convex 保存 -> Qdrant 同步 -> 后续召回”的主链路，这是非常重要的基础。

但如果继续沿用当前结构，随着记忆数量增长，会很快遇到：

- 记忆污染
- 误召回
- 用户不信任
- 同步失败不可见
- Agent 难以解释来源
- 自动记忆无法安全上线

下一阶段应把 Memory 从“长期记忆列表”升级为“Agent Context Governance System”。

核心方向：

- 用 Claude Code 式 Instruction Memory 管稳定规则。
- 用结构化 Semantic/Episodic/Procedural Memory 管长期知识和经验。
- 用 Inbox 和证据链管写入可信度。
- 用 scope-aware retrieval 和评估管召回质量。
- 用 Memory Center 管用户可见控制权。

这样 My-Notion 的 Agent 才能从“记得一些内容”升级为“知道自己为什么记、何时该用、用户如何控制”的可靠个人知识助手。
