# Mobile Agent Stream Client

## 做了什么

- 新增 Mobile Agent Stream 客户端，移动端可携带 Clerk token 请求 Web `/api/agent/stream`。
- 将 `ChatModal` 中的发送、流式输出、错误、重试、停止生成和 `resumeCursor` 续跑状态收敛到 `useAgentChatSession`。
- 新增 Agent Stream tool event 只读 UI 卡片，按工具调用 ID 归并执行中、完成/失败状态、结果摘要、sources 和可恢复错误提示。
- 统一 Mobile 加载态为纯白背景、灰色 spinner 和 i18n 文案，覆盖路由鉴权加载与首页数据加载。
- 闭环 `knowledgeBaseEnabled` 在 `/api/agent/stream` 链路下的语义：Mobile 传参，Web 按开关过滤 `knowledge_search`，checkpoint/resume 保持一致。
- 深度思考对齐 Web：Mobile 默认开启 `enableThinking`，不再展示单独开关，避免用户误以为这是需要手动启用的模式。
- 接入 AppState 切后台感知与网络异常分类，中断后基于 `resumeCursor` 给出更明确的“继续生成”提示。
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
- 优点：tool event 已有基础可视化，先只读展示工具名、运行状态、长结果展开、来源引用和可恢复错误，暂不引入确认式写入交互。
- 优点：加载态从深色/蓝色 spinner 收敛为更贴近 Notion 的极简浅色体验，并复用国际化文案。
- 优点：知识库开关现在能真实影响 Agent 可用工具，关闭时不再暴露 `knowledge_search`；`document_search` 和 `memory_search` 仍保留为独立上下文能力。
- 优点：深度思考默认开启且 UI 不暴露额外开关，交互更接近 Web 端，减少移动端底部工具条噪音。
- 优点：切后台、用户停止和网络异常会展示不同恢复文案，减少“卡住/失败”的不确定感。
- 局限：续跑状态仍是客户端本地快照，暂未做多设备同步；tool UI 暂不提供确认按钮或来源跳转。
- 局限：深度思考依赖模型实际能力，部分模型可能忽略 `enable_thinking` / `thinking_budget`。

## 2026-06-16 追加进展

- Mobile AI 本地/线上服务地址收敛：本地 `EXPO_PUBLIC_AI_SERVICE_URL` 使用 `http://localhost:3000`，线上使用 `https://notion-j9zj.vercel.app`，与 `pnpm start:web` 的 Web + Convex 开发方式保持一致。
- Web 端为 Mobile 调用补齐 CORS：`/api/agent/stream` 增加 `OPTIONS` 预检、允许 Mobile/Expo 常用 origin，并为 401/429/400/500 和 NDJSON 正常响应统一带上 CORS headers。
- 修复 Next.js `204 No Content` 响应构造：`/api/agent/stream`、`/api/chat`、`/api/rag`、`/api/upload-image` 的 `OPTIONS` 改用 `new NextResponse(null, { status: 204 })`，避免 `NextResponse.json(null, { status: 204 })` 触发 500。
- Mobile AI 深度思考最终策略：`useAgentChatSession` 默认 `enableThinking=true`，`ChatModal` 移除深度思考按钮和兼容提示，仅保留模型选择与知识库开关。
- Mobile 首页新增文档入口调整：撤掉独立“新建文章”卡片，改为 `知识库 / 收藏夹 / 个人` 每个分区标题右侧展示 `+`，更接近 Web/Notion Mobile 的信息架构。
- 分区创建语义：知识库分区创建默认知识库文档；收藏夹分区创建后标记 `isStarred=true`；个人分区创建后标记 `isInKnowledgeBase=false`；底部 `+` 默认创建个人文档。
- 当前实现仍有一个可优化点：分区创建暂时是 `create -> update` 两段式，后续建议扩展 `documents.create` 入参支持 `isStarred` / `isInKnowledgeBase`，减少一次 Convex mutation 并避免瞬时状态抖动。

## 验证

```bash
pnpm --filter @notion/mobile exec tsc --noEmit --pretty false
pnpm --filter @notion/mobile exec eslint src/features/ai-chat/components/ChatModal.tsx src/features/ai-chat/hooks/use-agent-chat-session.ts src/features/ai-chat/types.ts src/lib/ai/agent-stream.ts src/lib/ai/chat.ts
pnpm --filter @notion/mobile lint
pnpm --filter @notion/web typecheck
pnpm --filter @notion/mobile exec tsc --noEmit
pnpm --filter @notion/mobile exec eslint src/features/ai-chat/components/ChatModal.tsx src/features/home/components/home-screen.tsx src/features/home/components/collapsible-section.tsx src/features/ai-chat/hooks/use-agent-chat-session.ts
```

验证结果：

- Mobile typecheck 通过。
- 相关文件 ESLint 通过。
- Mobile lint 通过，保留既有 `app/(auth)/sign-in.tsx` 中 `Array<T>` 风格 warning。
- Web typecheck 通过。
- 2026-06-16 追加验证：Mobile `tsc --noEmit` 通过，Mobile 相关变更文件 ESLint 通过，VS Code diagnostics 无报错。

## 下一步

- 后续如需精确离线判断，可引入 NetInfo 并在断网前置禁用发送/恢复按钮。
- 优先优化 `documents.create` mutation，支持一次性传 `isStarred?: boolean` 和 `isInKnowledgeBase?: boolean`，替换 Mobile 当前分区创建的两段式 `create -> update`。
