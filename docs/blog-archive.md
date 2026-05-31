# Blog Archive

本文件压缩保留原 `docs/blog-*.md` 的历史复盘价值。原长文已删除，避免和当前工程文档混杂；需要恢复全文可从 git 历史查看。

## AI Sidebar Refactor

原文：`blog-ai-sidebar-refactor.md`

- AI Chat 从全屏页面迁移到文档右侧可折叠侧边栏。
- 将多个碎片化 Zustand store 收敛到更清晰的 hook/组件边界。
- 补齐可拖拽宽度、持久化、浮动入口、乐观 UI、中文 IME 和错误边界。
- 当前稳定结论已沉淀到 `milestones/M10-ai-chat-sidebar.md` 和 Web README。

## ReAct Agent Loop

原文：`blog-react-agent-loop.md`

- 从关键词硬编码路由迁移到标准 ReAct Loop。
- LLM 自主决定是否调用 `knowledge_search`、`web_search`、`document_read` 等工具。
- 记录了 DashScope `enable_thinking`、`tool_choice`、多 tool_calls 和 NDJSON 事件协议的兼容经验。
- 当前稳定结论已沉淀到 `milestones/M14-react-agent-loop.md` 和 `docs/ai-chat-refactor-plan.md`。

## Tool Call Visualization

原文：`blog-tool-call-visualization.md`

- 将工具调用结果从流式临时状态改为可持久化、可回看的 UI 卡片。
- 覆盖联网搜索、知识库检索、文档读取等工具的差异化展示。
- 总结了 tool result 收集、消息完成时写入、历史加载还原和 i18n 处理。
- 当前稳定结论已沉淀到 `milestones/M15-ux-polish-markdown-rendering.md`。

## Convex Deploy Pitfalls

原文：`blog-convex-deploy-pitfalls.md`

- 记录了 Convex 生产部署为空、页面预加载查询、Clerk JWT issuer、Qdrant localhost、E2E 旧路由、i18n 双前缀等上线坑。
- 可作为部署排障知识库，但当前配置以 `AGENTS.md`、Web README 和环境变量实际状态为准。
- 涉及 CLI Machine API 时必须使用 Convex `.site` URL；Convex client/runtime 使用 `.cloud` URL。

## pnpm Monorepo

原文：`blog-pnpm-monorepo.md`

- 解释 npm/yarn/pnpm 的依赖模型差异、幽灵依赖、workspace 协议和 monorepo 依赖冲突处理。
- 记录 React 多实例、ProseMirror 版本、workspace 发布依赖和 peerDependencies 的排查方法。
- 当前项目仍使用 pnpm monorepo，验证命令以根 README 和 `AGENTS.md` 为准。

## Mobile AI Debug

原文：`blog-mobile-ai-debug.md`

- 记录 Mobile 真机 AI 请求无日志、Vercel 路由冲突、Expo 环境变量、`.vercel.app` 网络限制、SSE 平台分流和 WebWorker lib 等问题。
- 可作为排障背景，当前操作手册以 `mobile-debug-guide.md` 为准。

## Vercel Edge Runtime

原文：`blog-vercel-edge-runtime.md`

- 记录 Vercel Serverless 调国内 DashScope 504、区域切换无效、Edge Runtime 改善首包的排查过程。
- 这是一份历史复盘，不代表当前唯一生产部署建议；`services/ai` 如需更稳定区域控制，可参考 `fly-io-deployment-guide.md`。
