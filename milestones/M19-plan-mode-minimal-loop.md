# M19: Plan 模式最小闭环

## 状态总览

- 状态：已完成。
- 更新时间：2026-06-02。
- 本阶段交付目标：基于 `task_plan` tool 完成“生成计划 -> 用户确认 -> 执行步骤 -> 状态可见”的最小产品闭环。
- 本阶段非目标：步骤级事件流、Plan 状态持久化、跨刷新恢复、Web Agent MCP adapter。

## 目标

将已有 `task_plan` 从只读计划生成工具推进为可操作的 Plan 模式：用户可以显式进入计划模式，Agent 先产出结构化计划，不在确认前执行写入或持久化操作；用户确认后，系统按已确认计划继续执行。

## 已完成

### Plan 模式入口

- AI Chat 输入框新增 Plan 模式切换。
- Plan 模式请求会向 `/api/agent/stream` 传递 `mode: "plan"`。
- 普通 Chat 模式保持原有 ReAct Agent 行为。

### Plan-only 后端约束

- `/api/agent/stream` 在 Plan 模式下只暴露 `task_plan` tool。
- Plan 模式 system prompt 明确要求先调用 `task_plan`，并禁止确认前调用写入、记忆写入或其他不可逆操作。
- Plan 模式完成后要求用户审查并确认计划。

### 计划确认与执行

- `task_plan` Tool 卡片展示 objective、步骤标题、描述和状态。
- 计划卡片新增“确认执行”入口。
- 用户确认后，前端将结构化计划转换为执行 prompt，并以普通 Chat 模式继续发送给 Agent。
- 执行按钮展示待确认、启动中、已开始执行等本地状态。

### 路线调整

- 已移除 Spec 模式作为后续主线。
- M20 收敛为 Web Agent MCP adapter。

## 关键决策

- Plan 模式是用户显式选择的运行模式，不默认拦截所有复杂任务。
- Plan 模式只负责生成和确认计划；真实执行仍复用现有 ReAct Loop 和写入确认链路。
- 确认后执行不新增数据库表，先通过新一轮 Chat 请求实现最小闭环。
- 写入或持久化变更仍遵循 `Dry-run -> Preview -> User Confirmation -> Commit`。

## 验证

- `pnpm --filter @notion/web test -- ai-chat-components.test.ts stream-client.test.ts tools.test.ts`: ✅
- `pnpm --filter @notion/web typecheck`: ✅
- `pnpm --filter @notion/web lint`: ✅，仅有既有 warning，无 error。
- `pnpm --filter @notion/web build`: ✅
- 用户本地试用：✅，未发现明显问题。

## 已知缺口

- 计划“已开始执行”是前端本地状态，刷新后不会恢复。
- 步骤级执行进度暂由 Agent 新回复自然呈现，未做逐 step 事件流。
- 计划确认状态未回写到 `aiMessages.toolResults`。

## 后续规划

- M20 Web Agent MCP adapter：让 Web Agent 安全调用受控 MCP 工具。
- Plan 状态增强：按真实使用反馈补步骤级事件、持久化和跨刷新恢复。
- 流式重试与 Tool 结果契约细化：提高执行韧性。

## 关联文档

- `docs/ai-chat-refactor-plan.md`
- `progress/20260602-173825.md`
- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
- `apps/web/src/app/api/agent/stream/route.ts`
