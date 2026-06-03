# M23 Agent Memory Schema Foundation

## 目标

把当前 `agentMemories` 从 MVP 单表扩展为可承载长期治理的 Memory 基础模型，为后续检索、Inbox、Memory Center 和自动提取打底。

本阶段只做兼容性 schema 与 Convex logic 基础层，不改变用户可见主流程，不强制迁移旧数据。

## 对齐总方案

来源文档：

- `docs/agent-memory-redesign-report.md`

对应总方案章节：

- `6. 数据模型重构规格`
- `9. 迁移方案` 的 Phase 0 和 Phase 1
- `13. 建议优先级` 中的 schema 扩展

## 前置依赖

- M17 Memory MVP 已存在：`agentMemories`、`memory_read`、`memory_write`、Memory Review UI。
- 不依赖 M20 MCP adapter。
- 不依赖 M24-M27，但必须为它们提供字段与状态基础。

## 范围

### In Scope

- 扩展 `agentMemories` schema，新增 Memory 分层、作用域、证据链、治理状态、同步状态字段。
- 保留旧 `type` 字段兼容现有 `preference | project | episodic`。
- 在 create/list/update/deactivate logic 中填充新字段默认值。
- 提供旧数据到新模型的派生映射工具。
- 增加基础查询索引，支持后续按 status/kind/scope/embeddingStatus 查询。
- 补充单元测试或最小可验证用例，证明旧数据与新数据都能读写。

### Out of Scope

- 不实现新的 `memory_search` 排序算法。
- 不改 Agent 自动注入策略。
- 不改前端页面信息架构。
- 不实现 Inbox。
- 不实现自动提取。

## 关键设计

### Memory Kind

新增 `kind`：

```ts
type MemoryKind = "instruction" | "semantic" | "episodic" | "procedural";
```

含义：

- `instruction`：稳定规则、用户偏好、项目约束。
- `semantic`：长期事实、实体、项目知识。
- `episodic`：会话事件、关键决策、任务过程。
- `procedural`：工作流、工具使用经验、成功/失败模式。

### Category

新增 `category: string`，用于承载更细粒度分类。

建议默认值：

| 旧 `type` | 新 `kind` | 新 `category` |
| --- | --- | --- |
| `preference` | `instruction` | `user_preference` |
| `project` | `semantic` | `project_fact` |
| `episodic` | `episodic` | `session_note` |

### Scope

新增：

```ts
scopeLevel:
  | "user"
  | "workspace"
  | "project"
  | "document"
  | "conversation"
  | "module"
  | "path";
scopeKey: string;
```

M23 默认：

- `scopeLevel = "user"`
- `scopeKey = userId`

后续 M24-M27 再逐步接入更细 scope。

### Status

扩展状态：

```ts
type MemoryStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "superseded"
  | "archived"
  | "rejected"
  | "deleted";
```

M23 默认仍创建为 `active`，不改变现有用户体验。

### Evidence

新增可选证据字段：

- `evidenceConversationId`
- `evidenceMessageId`
- `evidenceDocumentId`
- `evidenceToolCallId`
- `evidenceText`
- `evidenceUrl`

M23 先只支持字段落库，不要求所有调用点填充。

### Governance

新增：

- `importance`
- `stability`
- `privacy`
- `reviewDueAt`
- `lastUsedAt`
- `usageCount`
- `supersedes`
- `conflictsWith`

默认：

- `importance = 0.5`
- `stability = "evolving"`
- `privacy = "normal"`
- `usageCount = 0`

### Embedding Sync

新增：

- `embeddingStatus`
- `embeddingUpdatedAt`
- `embeddingError`
- `embeddingRetryCount`
- `nextEmbeddingRetryAt`

默认：

- `embeddingStatus = "pending"`，内容为空或敏感不可索引时后续阶段可改为 `skipped`。
- `embeddingRetryCount = 0`

## 涉及文件

### 必改

- `packages/convex/schemas/agentMemories.ts`
- `packages/convex/agentMemories/logic/create.ts`
- `packages/convex/agentMemories/logic/list.ts`
- `packages/convex/agentMemories/logic/update.ts`
- `packages/convex/agentMemories/logic/deactivate.ts`

### 可能修改

- `apps/web/convex/agentMemories.ts`
- `apps/web/convex/_generated/api.d.ts`
- `apps/web/convex/_generated/dataModel.d.ts`
- `packages/convex/index.ts`
- `apps/web/src/lib/agent/tools/memory.ts`

## 任务拆分

1. 扩展 schema 字段与索引。
2. 新增 memory model helper：旧 `type` 到新 `kind/category/scope` 的默认映射。
3. 修改 `createAgentMemory`，写入新字段默认值。
4. 修改 `listAgentMemories`，返回新字段，同时兼容旧消费者。
5. 修改 `updateAgentMemory`，允许更新新字段中的安全子集。
6. 修改 `deactivateAgentMemory`，保持 `deleted` 兼容。
7. 运行 Convex codegen。
8. 补充或更新基础测试。

## 验收标准

- 旧 `memory_read` / `memory_write` 主链路不回归。
- 旧记录即使没有新字段，也能通过 derived defaults 被正常展示和召回。
- 新建记录具备 `kind/category/scope/status/embeddingStatus`。
- 后续 M24 能基于 `scopeLevel/scopeKey/kind/category` 做检索。
- 后续 M25 能基于 `pending_review` 做 Inbox。
- 后续 M26 能展示 evidence/governance/sync 状态。

## 验证命令

```bash
pnpm --filter @notion/web exec convex codegen
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
```

如涉及共享包测试：

```bash
pnpm test
```

## 风险

- Convex schema 改动需要确保可选字段兼容线上旧数据。
- 索引新增后查询逻辑要避免破坏现有 `by_user_and_status` 调用。
- 新字段过多会增加 UI 与测试负担，M23 只做基础落库，不做产品复杂度扩散。

## 与下一阶段衔接

M23 完成后进入 M24：

- M24 使用 `kind/category/scope` 实现 `memory_search`。
- M24 使用 `embeddingStatus` 移除读路径 upsert。
- M25 使用 `pending_review` 和 evidence 字段实现 Inbox。

