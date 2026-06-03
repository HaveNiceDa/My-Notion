# M26 Agent Memory Center UI

## 状态

- 状态：已完成
- 完成时间：2026-06-03
- 过程记录：`progress/20260603-183215.md`

## 目标

将现有 `/memories` 从“长期记忆 CRUD 列表”升级为 “Memory Center”，让用户能集中理解、审核、治理和调试 Agent 的长期记忆。

本阶段解决“前端页面是否符合 Agent Memory 心智”的问题：用户不仅要能编辑记忆，还要能知道记忆从哪里来、是否可信、是否同步成功、是否过期、是否冲突、是否被 Agent 使用。

## 对齐总方案

来源文档：

- `docs/agent-memory-redesign-report.md`

对应总方案章节：

- `4.9 前端页面是 CRUD，不是 Memory Center`
- `8. 前端 Memory Center 重构规格`
- `10.2 UI 测试`
- `11. 分阶段实施路线` 的 Milestone D

## 前置依赖

- 必须完成 M23：页面需要新 schema 字段。
- 必须完成 M25：页面需要 pending_review 与 Inbox mutations。
- 建议完成 M24：页面展示召回与使用状态更完整。

## 范围

### In Scope

- 重构 `/memories` 页面为 Memory Center。
- 拆分大型组件，避免 `MemoryReviewPage.tsx` 继续膨胀。
- 增加 Overview / Inbox / Active / Conflicts / Settings。
- 增加 Memory Detail Drawer。
- 展示 evidence、embeddingStatus、usage、reviewDueAt、privacy、scope。
- 支持基础过滤、搜索、排序。
- 完成中英文 i18n。
- 补充 UI 组件测试。

### Out of Scope

- 不实现自动提取。
- 不实现复杂可视化图谱。
- 不做真实 Eval dashboard。
- 不引入新的 UI 设计系统。

## 页面信息架构

路由保持：

- `/memories`

页面结构：

```text
MemoryCenterPage
├── MemoryOverview
├── MemoryInbox
├── MemoryActiveList
├── MemoryConflicts
├── MemorySettings
└── MemoryDetailDrawer
```

### Overview

展示指标：

- Active memories
- Pending review
- Sync failed
- Review due
- Sensitive memories
- Recently used

入口卡片：

- 待审核记忆
- 同步失败
- 即将过期
- 最近被 Agent 使用

### Inbox

复用 M25 的 pending review。

能力：

- Accept
- Edit and accept
- Reject
- Merge hint display
- Evidence preview

### Active

替代当前列表。

过滤器：

- query
- kind
- category
- scope
- embeddingStatus
- privacy
- updatedAt

卡片展示：

- content / summary
- kind/category badge
- scope badge
- confidence / importance
- lastUsedAt / usageCount
- embeddingStatus
- evidence link

### Conflicts

M26 先做基础视图，不要求复杂自动合并。

展示：

- `conflictsWith`
- `supersedes`
- possible duplicate hints
- stale candidates

操作：

- View detail
- Supersede
- Keep both
- Archive

### Settings

先做静态或最小可持久化设置。

建议项：

- 自动记忆模式：off / explicit only / suggestions to inbox / auto for low-risk
- 敏感信息策略：never save / require confirm / allow manual only
- 默认作用域：user / project / document
- episodic 默认过期时间
- 是否允许 Agent 当前对话中打断提示保存

如暂不做持久化，可明确标记为后续设置项。

### Detail Drawer

展示：

- 正文
- summary
- kind/category/scope
- source/createdBy
- evidence message/document/tool call
- sync status
- usage history
- related/conflicting memories
- edit/archive/delete

## 涉及文件

### 必改

- `apps/web/src/components/ai-chat/MemoryReviewPage.tsx`
- `apps/web/src/app/[locale]/(main)/(routes)/memories/page.tsx`
- `packages/business/i18n/zh-CN.json`
- `packages/business/i18n/en.json`

### 建议新增

- `apps/web/src/components/ai-chat/memory/MemoryCenterPage.tsx`
- `apps/web/src/components/ai-chat/memory/MemoryOverview.tsx`
- `apps/web/src/components/ai-chat/memory/MemoryInbox.tsx`
- `apps/web/src/components/ai-chat/memory/MemoryActiveList.tsx`
- `apps/web/src/components/ai-chat/memory/MemoryConflicts.tsx`
- `apps/web/src/components/ai-chat/memory/MemorySettings.tsx`
- `apps/web/src/components/ai-chat/memory/MemoryDetailDrawer.tsx`
- `apps/web/src/components/ai-chat/memory/types.ts`
- `apps/web/src/components/ai-chat/memory/utils.ts`

### 可能修改

- `apps/web/src/app/[locale]/(main)/_components/Navigation.tsx`
- `apps/web/src/components/ai-chat/ai-chat-components.test.ts`

## 任务拆分

1. 新建 `memory/` 子目录，拆分组件。
2. 将旧 `MemoryReviewPage` 替换为 `MemoryCenterPage` 入口。
3. 实现 Overview 指标查询和展示。
4. 接入 M25 Inbox。
5. 实现 Active 列表、搜索、过滤。
6. 实现 Conflicts 基础视图。
7. 实现 Settings 最小 UI。
8. 实现 Detail Drawer。
9. 补充 i18n 文案。
10. 增加组件测试。

## 验收标准

- `/memories` 不再只是 CRUD 列表。
- 用户可以看到 pending、active、sync failed、review due 等状态。
- 用户可以从任意记忆打开详情，看到 evidence 和 sync 状态。
- Inbox 操作不回归。
- 旧记忆可在 Active 中正常展示。
- 页面组件职责清晰，不把所有逻辑堆在单个文件。
- 所有用户可见文案走 `next-intl`。

## 验证命令

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
```

建议：

```bash
pnpm --filter @notion/web test -- ai-chat-components
```

## 风险

- UI 范围容易膨胀，M26 应优先交付信息架构和核心状态，不追求一次性完善所有高级交互。
- Settings 如果没有后端 schema 支撑，应先做只读说明或 feature flag，避免假设置。
- 大量 i18n 文案需要同步维护中英文。

## 与下一阶段衔接

M26 完成后进入 M27：

- M27 可以在 Overview 中接入 Eval 和自动提取统计。
- M27 的自动提取 proposals 进入 M26 已有 Inbox。
- M27 的 retrieval/write/conflict 指标可在 Memory Center 后续增强展示。
