# Mobile Agent Stream Client

## 做了什么

- 新增 Mobile Agent Stream 客户端，移动端可携带 Clerk token 请求 Web `/api/agent/stream`。
- 将 `ChatModal` 中的发送、流式输出、错误、重试、停止生成和 `resumeCursor` 续跑状态收敛到 `useAgentChatSession`。
- 新增 Agent Stream tool event 只读 UI 卡片，按工具调用 ID 归并执行中、完成状态和结果摘要。
- 统一 Mobile 加载态为纯白背景、灰色 spinner 和 i18n 文案，覆盖路由鉴权加载与首页数据加载。
- 保留 `EXPO_PUBLIC_MOBILE_AGENT_STREAM=0` fallback，可临时切回旧 `/api/chat`、`/api/rag` 兼容层。
- 清理移动端 AI Chat 旧共享 hooks 依赖，改成本地状态，避免 `@notion/business/hooks` 不存在导出导致编译失败。
- 补齐 `twrnc` 类型声明与 Mobile Convex 类型解析，确保移动端 typecheck 可通过。

## 为什么这样做

- Mobile 当前目标是复用 Web AI 后端能力，而不是在端侧重新实现 LLM、RAG、Memory 和 Agent tools。
- Agent Stream 是后续 checkpoint/resume、停止生成、弱网恢复和 tool 状态展示的统一协议入口。
- 先抽状态机 hook，能避免后续把 `runId`、`lastAppliedSeq`、`AbortController`、tool events 和本地缓存继续堆进 UI 组件。

## 实现优缺点

- 优点：`ChatModal` 明显变薄，网络协议和客户端状态边界更清晰；旧兼容层仍可回退，风险可控。
- 优点：停止生成已具备基础能力，`resumeCursor`、会话 ID 和已流式输出内容会落到 AsyncStorage，用于中断后的继续生成。
- 优点：tool event 已有基础可视化，先只读展示工具名、运行状态和短结果，暂不引入确认式写入交互。
- 优点：加载态从深色/蓝色 spinner 收敛为更贴近 Notion 的极简浅色体验，并复用国际化文案。
- 局限：续跑状态仍是客户端本地快照，暂未做多设备同步；tool UI 暂未展示结构化引用、确认按钮或可展开详情。
- 局限：知识库开关在 Agent Stream 默认链路下暂未映射为明确 Agent 策略，后续需要统一产品语义。

## 验证

```bash
pnpm --filter @notion/mobile exec tsc --noEmit --pretty false
pnpm --filter @notion/mobile exec eslint src/features/ai-chat/components/ChatModal.tsx src/features/ai-chat/hooks/use-agent-chat-session.ts src/features/ai-chat/types.ts src/lib/ai/agent-stream.ts src/lib/ai/chat.ts
pnpm --filter @notion/mobile lint
```

验证结果：

- Mobile typecheck 通过。
- 相关文件 ESLint 通过。
- Mobile lint 通过，保留既有 `app/(auth)/sign-in.tsx` 中 `Array<T>` 风格 warning。

## 下一步

- 梳理知识库/深度思考开关在 Agent Stream 链路下的语义，避免 UI 与实际 Agent 策略不一致。
- 增强 tool event UI，支持结构化 sources、长结果展开和可恢复错误提示。
- 补充 AppState/网络状态感知，让切后台和弱网中断的提示更明确。
