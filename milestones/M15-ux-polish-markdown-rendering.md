# M15: AI Chat 体验优化 + Markdown 渲染

## 目标

在 M14 ReAct Agent Loop 架构基础上，优化 AI Chat 的交互体验、视觉一致性和内容渲染质量，修复已知 Bug。

## 关键改动

### 1. web_search 流式优化

| 文件 | 改动 |
|---|---|
| `lib/agent/stream.ts` | `AgentStreamEvent` 新增 `tool-result-delta` 事件类型 |
| `lib/agent/tools/types.ts` | 新增 `ToolStreamOutput` 接口，`ToolContext` 新增可选 `stream` 字段 |
| `lib/agent/tools/web-search.ts` | 从非流式改为 `stream: true`，逐 chunk 推送 `tool-result-delta` 事件 |
| `lib/agent/tools/definitions.ts` | `webSearchTool.execute` 传 `ctx` 而非 `ctx.model` |
| `lib/agent/react-loop.ts` | 执行 tool 前注入 `stream: { controller, encoder, toolCallId }` |
| `components/ai-chat/types.ts` | `ToolCall` 新增 `streamingResult` 字段；`AgentStreamEvent` 新增 `tool-result-delta` |
| `components/ai-chat/useAIChat.ts` | `runAgentStream` 新增 `onToolResultDelta` 回调，累积 `streamingResult` |

**效果**：用户发起联网搜索时，搜索结果实时流式展示，不再长时间卡在"执行中"状态。

### 2. AI 侧边栏 UI 优化（7 项）

| # | 改动 | 文件 |
|---|---|---|
| 1 | 去掉固定按钮，侧边栏默认固定占据空间 | `use-ai-chat-store.ts`（删除 `panelPinned`/`togglePinned`） |
| 2 | 关闭 icon → 折叠 icon（`PanelRightClose`），hover 提示"隐藏对话"（i18n） | `AIChatPanel.tsx` + `zh-CN.json`/`en.json` |
| 3 | 对话记录下拉框点击空白区域收起 | `AIChatPanel.tsx`（`mousedown` 外部点击监听） |
| 4 | 新对话 icon 移到右侧（折叠 icon 左边） | `AIChatPanel.tsx` |
| 5 | 深度思考默认打开，移除 toggle icon | `MessageInput.tsx` + `useAIChat.ts`（`useState(true)`，删除 `toggleThinking`） |
| 6 | 模型选择改为展示模型名的按钮 + Popover | `MessageInput.tsx`（`Popover` + `MODEL_DISPLAY_NAMES`） |
| 7 | AI icon 替换为项目 logo（`image.png`），暗色模式自动切换反色版本 | `Navigation.tsx` + `AIFloatingButton.tsx` + `Item.tsx` |

### 3. Bug 修复

| Bug | 修复 | 文件 |
|---|---|---|
| ThemeProvider `<script>` 警告 | 开发环境过滤 `console.error` 中的误报警告 | `theme-provider.tsx` |
| 发送消息延迟 ~1s | 先更新 UI（清空输入、显示用户消息），后台持久化到 Convex | `useAIChat.ts` |
| IME 中文输入法回车误发送 | 检查 `e.nativeEvent.isComposing`，组合输入中不触发发送 | `MessageInput.tsx` |

### 4. Logo / Favicon 替换

| 改动 | 说明 |
|---|---|
| `image.png` 白底转透明 | Pillow `getbbox()` 裁剪边距 + 白色像素替换为透明 |
| `image-dark.png` 暗色版本 | RGB 反色 + 保留透明通道 |
| `favicon.ico` + `favicon-*.png` | 从 1280px 原图 LANCZOS 缩放生成多尺寸 |
| `layout.tsx` icons 配置 | 优先 PNG 格式 + `media: "(prefers-color-scheme: dark)"` 条件 |
| `Logo.tsx` | 双 Image 组件按 `dark:hidden` / `hidden dark:block` 切换 |
| `AIFloatingButton.tsx` | 圆形按钮（`rounded-full`），图标 `h-7 w-7`，暗色模式双图切换 |
| `Navigation.tsx` | `AIIcon` 组件替换 `Sparkles`，暗色模式双图切换 |

### 5. Markdown 渲染

| 文件 | 改动 |
|---|---|
| `MarkdownRenderer.tsx` | 新增组件，封装 `react-markdown` + `remark-gfm` + `rehype-highlight` |
| `MessageList.tsx` | 所有 `<p className="whitespace-pre-wrap">` 替换为 `<MarkdownRenderer>`，包括思考内容 |
| `globals.css` | 内联 highlight.js 代码高亮主题（浅色 GitHub 风格 + 暗色模式适配） |

**新增依赖**：`react-markdown`、`remark-gfm`、`rehype-highlight`

**渲染能力**：标题层级、列表、代码块（语法高亮）、行内代码、表格、引用、链接、加粗/斜体、删除线、任务列表

## 验证

- `pnpm --filter @notion/web exec tsc --noEmit`: ✅
- `pnpm --filter @notion/web build`: ✅
- `pnpm --filter @notion/web lint`: ✅（4 个既有 warning）

## 关联 progress 文件

- 本次会话改动统一记录在本 milestone 中

## 后续待办

- Spec 模式 / Plan 模式（P1）
- MCP 接入（P2）
- Tool 结果缓存（P3）
