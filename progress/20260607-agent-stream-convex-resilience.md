# 2026-06-07 Agent Stream Convex Resilience

## 目标

- 修复本地 AI 对话中 `/api/agent/stream` 因 Clerk/Convex 网络失败直接 500 的问题。
- 降低 Agent 已输出完成但前端仍停留在 loading 的概率。

## 改动

- `getAuthenticatedConvexClient` 捕获 `getToken({ template: "convex" })` 的 Clerk 网络异常，降级为无 Convex run recording，而不是让 API route 直接 500。
- `createAgentRun` 失败时仅关闭本次 run recording，不阻断 Agent 主回答链路。
- Agent 主回答结束后先写 `run_finished` checkpoint 并发送 `finish` 事件，再异步执行 Memory 自动提取。
- `finishAgentRun` 状态写回改为 fire-and-forget，避免 Convex 短时超时阻塞客户端收尾。
- `AgentRunRecorder.flush()` 增加 1.5s 上限，超时后关闭客户端 stream，避免 pending Convex 持久化导致前端长时间 loading。
- 前端 `useAIChatStream` 在 `onComplete` 开头即清除 loading，后续消息持久化和会话刷新不再影响用户看到的生成状态。

## 验证

- `pnpm --filter @notion/web typecheck`：通过。
- `pnpm --filter @notion/web test -- stream-client.test.ts`：通过，实际运行 11 个相关/邻近测试文件，共 126 个测试。

## 风险

- Convex 不可用时，本次 Agent run 的续跑记录可能缺失；这是为了优先保证 AI 对话主链路可用。
- Memory 自动提取改为后台执行，如果进程被中断，可能丢失本次自动提取 proposal，但不影响本次回答。
