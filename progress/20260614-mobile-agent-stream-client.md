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
- 该阶段遗留的分区创建两段式问题已在后续 P0 原子化创建收口中解决。

## 2026-06-16 P0 原子化创建收口

- 扩展共享 Convex `documents.create` mutation，新增可选入参 `isStarred?: boolean` 和 `isInKnowledgeBase?: boolean`。
- 保持旧默认行为不变：未显式传参时仍创建非收藏、加入知识库的文档。
- Mobile 首页分区新建改为单次 `create` 完成状态初始化，替换收藏夹/个人分区原先的 `create -> update` 两段式调用。
- 这样可以避免新建后列表短暂落入默认知识库状态，减少一次 Convex mutation，也降低重复点击或弱网下的状态抖动概率。

## 2026-06-16 NetInfo 离线判断收口

- 按 Expo SDK 54 兼容版本新增 `@react-native-community/netinfo@11.4.1`。
- `useAgentChatSession` 接入网络状态监听，只有明确 `isConnected=false` 或 `isInternetReachable=false` 时判定离线，未知状态默认不拦截。
- 发送和继续生成前增加离线前置拦截，离线时不创建会话、不写入用户消息、不发起 Agent Stream 请求。
- 生成中如果检测到网络断开，会主动 abort 当前请求并进入 network interruption 状态，复用已有 `resumeCursor` 恢复链路。
- `ChatModal` 增加离线提示，断网时禁用发送、重试和继续生成按钮，避免用户在无网络状态下重复触发失败请求。

## 2026-06-16 正文图片上传补强

- `inline-image-upload` 新增可识别错误类型，区分相册权限拒绝、上传失败和服务端响应缺失 URL。
- 文档页正文图片插入前复用图片类型与 5MB 大小校验，权限拒绝、格式不支持、文件过大、上传失败分别展示明确 toast。
- 用户取消选择仍保持安静返回，不弹错误，避免把主动取消误判为失败。
- 图片插入成功后提示正在保存，并在顶部返回按钮触发前 flush 待保存正文 HTML，降低插入图片后立刻返回导致内容未落库的风险。
- 当前保存与重开渲染仍走既有 `editor.setImage(url) -> useEditorContent(html) -> serializeHtmlToBlockNote -> getEditorContentFromStoredContent` 兼容链路，未引入新的内容格式。

## 2026-06-16 正文图片上传补强

- `inline-image-upload` 新增可识别错误类型，区分相册权限拒绝、上传失败和服务端响应缺失 URL。
- 文档页正文图片插入前复用图片类型与 5MB 大小校验，权限拒绝、格式不支持、文件过大、上传失败分别展示明确 toast。
- 用户取消选择仍保持安静返回，不弹错误，避免把主动取消误判为失败。
- 图片插入成功后提示正在保存，并在顶部返回按钮触发前 flush 待保存正文 HTML，降低插入图片后立刻返回导致内容未落库的风险。
- 当前保存与重开渲染仍走既有 `editor.setImage(url) -> useEditorContent(html) -> serializeHtmlToBlockNote -> getEditorContentFromStoredContent` 兼容链路，未引入新的内容格式。

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
- 2026-06-16 P0 原子化创建：Mobile `tsc --noEmit` 通过，首页相关 ESLint 通过，Web typecheck 通过，VS Code diagnostics 无报错。
- 2026-06-16 NetInfo 离线判断：`pnpm@10.28.1 install --frozen-lockfile` 通过，Mobile `tsc --noEmit` 通过，AI Chat 相关文件 ESLint 通过，VS Code diagnostics 无报错。
- 2026-06-16 正文图片上传补强：Mobile `tsc --noEmit` 通过，文档页与 `inline-image-upload` ESLint 通过，Mobile lint 通过且仅保留既有 `sign-in.tsx` array-type warning，VS Code diagnostics 无报错。
- 2026-06-16 正文图片上传补强：Mobile `tsc --noEmit` 通过，文档页与 `inline-image-upload` ESLint 通过，VS Code diagnostics 无报错。

## 2026-06-16 正文图片上传补强

- 正文图片上传错误恢复已补强，覆盖权限拒绝、格式/大小校验、上传失败提示，以及插入后返回前 flush 待保存正文。

## 2026-06-16 Mobile Tool Sources 跳转

- AI Chat tool result sources 从只读展示升级为可追溯入口：document source 可跳转到对应移动端文档页，web source 可调用系统链接打开。
- Memory source 暂保持只读展示，避免在 Memory Center 移动端入口未成型前引入无效跳转。
- 打开来源失败时展示 i18n toast，避免用户点击后无反馈。
- 验证：Mobile `tsc --noEmit` 通过，`ChatModal.tsx` ESLint 通过。

## 下一步

- 下一步优先继续做 Mobile Agent currentDocument 上下文接入，或做正文图片上传真机实测。
