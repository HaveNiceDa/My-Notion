# M25 Agent Memory Inbox Confirmation

## 状态

- 状态：已完成
- 完成时间：2026-06-03
- 过程记录：`progress/20260603-181537.md`

## 目标

把 Agent 记忆写入从“Tool 卡片单点确认”升级为“提议进入 Inbox、用户集中审核、确认后提交”的治理链路。

本阶段解决“Agent 什么时候能保存记忆、用户如何不遗漏、如何处理重复/冲突”的问题。

## 对齐总方案

来源文档：

- `docs/agent-memory-redesign-report.md`

对应总方案章节：

- `4.5 写入确认缺少统一 Inbox`
- `4.6 缺少证据链`
- `4.7 缺少去重、合并、冲突治理`
- `7. Agent 读写链路重构规格`
- `8.4 Tool 卡片改造`
- `9. 迁移方案` 的 Phase 2

## 前置依赖

- 必须完成 M23：需要 `pending_review`、evidence、governance 字段。
- 建议完成 M24：使用 `memory_search` 做重复/冲突预检查。
- 不依赖 M26 完整 Memory Center，但 M25 需要提供 Inbox 最小 UI。

## 范围

### In Scope

- 将 Agent 记忆写入拆成 propose/commit 两段。
- 引入 `pending_review` 状态。
- 新增 Inbox 最小页面能力：待审核列表、接受、编辑后接受、拒绝。
- Tool 卡片保存行为改为可直接 commit，也可送入 Inbox。
- Agent 自动提议默认进入 Inbox，不直接 active。
- 保存 evidence：conversation/message/toolCall/document/sourceText。
- 引入最小重复检测和冲突提示。
- 持久化 Tool result 中的 memory proposal 状态。

### Out of Scope

- 不实现完整 Memory Center 的 Overview/Conflicts/Settings。
- 不实现复杂合并 UI。
- 不实现自动提取器。
- 不实现 LLM 自动冲突裁决。

## 关键设计

### 写入状态流

```text
memory_propose
  -> pending_review
  -> Inbox
  -> accept / edit_accept / reject
  -> active / rejected
  -> embeddingStatus=pending
```

用户明确在 Tool 卡片中点击“保存”时可跳过 Inbox：

```text
memory_propose dry-run
  -> Tool card confirm
  -> memory_commit
  -> active
```

但所有 proposal 都应可在 Inbox 中追踪，避免用户错过。

### Tool 拆分

新增或内部抽象：

- `memory_propose`：生成 pending proposal。
- `memory_commit`：提交为 active。
- `memory_reject`：拒绝 proposal。

兼容：

- `memory_write` 继续存在，但内部变为 propose + dry-run result。

### Duplicate / Conflict 最小策略

M25 不做复杂模型判断，先做规则+向量相似：

- 相同 `kind/category/scope`。
- 内容 token overlap 或 semantic score 超阈值。
- 如果相似但不相同，标记 `possibleDuplicate`。
- 如果同类偏好出现相反关键词，标记 `possibleConflict`。

结果只作为 UI 提示，不自动替用户合并。

### Evidence

提议写入时尽量保存：

- `evidenceConversationId`
- `evidenceMessageId`
- `evidenceToolCallId`
- `evidenceDocumentId`
- `evidenceText`

Tool 卡片确认路径也要写入 evidence。

## 涉及文件

### 必改

- `apps/web/src/lib/agent/tools/memory.ts`
- `apps/web/src/lib/agent/tools/definitions.ts`
- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
- `packages/convex/agentMemories/logic/create.ts`
- `packages/convex/agentMemories/logic/update.ts`
- `packages/convex/chat/logic/updateToolResult.ts`
- `apps/web/src/components/ai-chat/MemoryReviewPage.tsx`
- `packages/business/i18n/zh-CN.json`
- `packages/business/i18n/en.json`

### 可能新增

- `packages/convex/agentMemories/logic/commit.ts`
- `packages/convex/agentMemories/logic/reject.ts`
- `packages/convex/agentMemories/logic/listPending.ts`
- `apps/web/src/components/ai-chat/memory/MemoryInbox.tsx`
- `apps/web/src/components/ai-chat/memory/MemoryProposalCard.tsx`

## 任务拆分

1. 新增 proposal 创建逻辑：默认 `status=pending_review`。
2. 新增 commit mutation：校验用户身份、proposal 状态、写入 active、设置 embedding pending。
3. 新增 reject mutation：设置 `status=rejected`。
4. 修改 `memory_write`，默认结果改成 proposal preview，真实提交由前端 mutation 负责。
5. 修改 Tool 卡片，支持“保存”“送入 Inbox”“取消”。
6. 在 `/memories` 页面增加 Inbox 最小 Tab 或 Section。
7. Inbox 支持 accept、edit accept、reject。
8. 将 proposal 状态写回 ai message tool result。
9. 增加 i18n 文案。
10. 增加工具与 UI 测试。

## 验收标准

- Agent 提议的记忆不会默认直接 active。
- 用户可在 Tool 卡片中快速保存或送入 Inbox。
- 用户错过 Tool 卡片后仍能在 Inbox 找到待审核记忆。
- Inbox 可接受、编辑接受、拒绝。
- 保存后的记忆带 evidence 字段。
- 重复/冲突提示至少能展示 possible duplicate/conflict。
- `memory_write` 旧路径仍保持 dry-run 安全。

## 验证命令

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke
```

建议增加 focused test：

```bash
pnpm --filter @notion/web test -- tools
```

## 风险

- Tool 卡片与 Inbox 双入口可能状态不一致，需要以 Convex memory status 为最终状态。
- 旧 aiMessages 中的 tool result 不一定有 proposalId，需要兼容。
- Inbox 最小 UI 不应过度复杂，否则会和 M26 Memory Center 边界混淆。

## 与下一阶段衔接

M25 完成后进入 M26：

- M26 复用 M25 的 Inbox 数据与 mutations。
- M26 在此基础上增加 Overview、Active、Conflicts、Settings、Detail Drawer。
- M25 的 proposal/evidence 是 M26 “信任与治理体验”的核心数据来源。
