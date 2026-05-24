# AI Chat 重构方案：剩余待办

> Phase 1-5 已在 M10-M14 全部完成。本文档仅保留 Phase 6 未完成项。

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
| 2.4 | Tool 结果缓存 | 相同 query 5 分钟内复用 tool result，LRU 缓存 | P3 | ❌ 未做 |
| 2.5 | 对话上下文压缩 | `context-compression.ts` 已实现，长对话 token 超限时自动压缩历史消息 | P1 | ✅ 完成 |
| 2.6 | 流式重试 | 网络中断时支持断点续传或自动重试 | P2 | ❌ 未做 |

### 6.3 工程化补齐

| # | 项目 | 具体内容 | 优先级 | 状态 |
|---|---|---|---|---|
| 3.1 | AI 模块 E2E 测试 | Playwright mock API 测试完整对话流程 | P2 | ❌ 未做 |
| 3.2 | Agent 性能监控 | Sentry 追踪 tool 执行耗时/LLM 响应延迟/ReAct 迭代次数 | P1 | ❌ 未做 |
| 3.3 | 环境变量校验 | `LLM_API_KEY` 等关键变量启动时校验，避免运行时才报错 | P2 | ❌ 未做 |
| 3.4 | API Rate Limiting | 纯内存滑动窗口限流（20 次/分钟/用户），零外部依赖 | P1 | ✅ 完成 |
| 3.5 | Storybook 组件文档 | AI Chat 组件可视化文档和交互示例 | P3 | ❌ 未做 |
| 3.6 | CI 集成 AI 测试 | GitHub Actions lint-typecheck.yml 的 unit-test job 已包含 `pnpm --filter @notion/web test`，59 个 AI 用例纳入 CI | P2 | ✅ 完成 |

### 6.4 建议优先级排序

1. **2.3 MCP 接入** — 扩展 AI 能力
2. ~~**1.3 Agent 后端测试补全** — 已有基础，覆盖度需确认~~ ✅ 已完成
3. **2.1 Spec 模式** — AI 能力升级的下一个里程碑
4. **3.2 Agent 性能监控** — 上线后可观测性关键
5. **1.4 前端 AI 组件测试** — 核心路径无测试
6. ~~**1.6 类型安全** — runAgentStream 参数重构~~ ✅ 已完成
7. **2.2 Plan 模式** — 与 Spec 模式互补
8. **2.6 流式重试** — 网络不稳定场景体验
9. **3.3 环境变量校验** — 开发体验改善
10. **3.6 CI 集成 AI 测试** — 工程化保障
11. **3.1 AI 模块 E2E 测试** — 全链路验证
12. **2.4 Tool 结果缓存** — 性能优化
13. **3.5 Storybook 组件文档** — 文档化

---

## DashScope 兼容性备忘

| 场景 | 处理方式 |
|---|---|
| `enable_thinking` + `tool_choice` | `tool_choice` 始终为 `"auto"`，不传 `object`/`required`，规避 400 错误 |
| 多 tool_calls | DashScope 支持单轮返回多个 tool_calls，ReAct 循环并行执行后统一加入 messages |
| thinking mode 首轮 | 不需要特殊处理，LLM 在 thinking 模式下可以正常返回 tool_calls |
