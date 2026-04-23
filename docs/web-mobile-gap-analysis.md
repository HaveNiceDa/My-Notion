# Web vs Mobile 功能差异与优化方案

> 扫描时间：2026-04-22（第二次更新）
> 上次扫描：2026-04-21

---

## 〇、变更摘要（相比 2026-04-21）

| 变更项 | 旧状态 | 新状态 |
|---|---|---|
| 编辑器格式互通 | 保存走纯文本，富文本格式丢失 | ✅ 已改为 HTML 双向转换，富文本格式保留 |
| 收藏/知识库切换 | 列表可展示但无操作入口 | ✅ `DocumentActionSheet` 实现收藏/知识库切换 |
| 回收站 | 无 | ✅ `trash.tsx` 完整 CRUD + 搜索 + 批量删除 |
| 文档重命名 | 无 | ✅ `RenameDialog` 独立弹窗 |
| 删除确认 | 无 | ✅ `ConfirmDialog` 通用确认弹窗 |
| Convex Schema 重复 | mobile 手动副本 | ✅ 已改为 re-export `@notion/convex/schemas` |
| `content-compat.ts` 位置 | mobile 本地 | ✅ 已提升到 `@notion/business/content-compat` |
| `formatRelativeTime` 硬编码中文 | 硬编码 | ✅ 已改为接收 `t` 函数参数 |
| Mobile 模板残留文件 | 存在 | ✅ 已清理（hello-wave、parallax-scroll 等） |
| Mobile mock 数据残留 | 存在 | ✅ 已清理 |
| HomeHeader 重复按钮 | 两个 changeLanguageLabel | ✅ 已修复 |
| `@notion/business/hooks` | 不存在 | ✅ 已创建，含 useSettings/useSearch/useNavigation |
| `@notion/business/validation` | 不存在 | ✅ 已创建，含 FileLike 接口 + 图片校验 |
| web `lib/utils.ts` | re-export cn + formatTime | ✅ 已精简为仅 `getBlockNoteLocale`（web 专属） |
| zustand 在 business 包中的依赖方式 | dependencies | ✅ 已改为 peerDependencies |
| Toast 反馈系统 | 无 | ✅ Mobile 新增 `toast-provider.tsx` |
| Mobile 主题色 | 紫色系 | ✅ 已改为蓝色系（#3b82f6） |
| Mobile Modal 主题同步 | 无处理 | ✅ 已用 TamaguiProvider + Theme 包裹 |

---

## 一、功能对比矩阵

### 🔴 Web 有但 Mobile 缺失的功能

| 功能 | Web 实现 | Mobile 现状 | 优先级 | 变更 |
|---|---|---|---|---|
| **封面图管理** | `Cover.tsx` + EdgeStore 上传/替换/删除 | 无 | P1 | — |
| **文档图标** | `Toolbar.tsx` + `icon-picker.tsx`（emoji picker） | `page-icon.tsx` 仅支持固定图标（document/folder/database），不支持自定义 emoji | P1 | 部分实现 |
| **发布/取消发布** | `Publish.tsx` 完整 popover（复制链接/公开切换） | 无 | P1 | — |
| **文档拖拽排序/移动** | `Item.tsx` 原生 Drag & Drop | 无 | P2 | — |
| **面包屑导航** | `Title.tsx` 多级路径 + 省略折叠 | 无 | P2 | — |
| **设置弹窗** | `SettingsModal.tsx` 外观 + 语言 | HomeHeader 的 Popover 中（语言/主题切换），功能已覆盖但 UI 形式不同 | P2 | 部分实现 |
| **Marketing 落地页** | `(marketing)` 路由组 | 无（移动端不需要） | — | — |

### ✅ 已补齐的功能

| 功能 | 实现方式 | 完成时间 |
|---|---|---|
| **编辑器格式互通** | `@notion/business/content-compat` 实现 BlockNote JSON ↔ HTML 双向无损转换，Mobile 保存时用 `useEditorContent({ type: "html" })` + `serializeHtmlToBlockNote` | 2026-04-22 |
| **收藏/知识库切换** | `DocumentActionSheet.tsx` 中 toggleStar / toggleKnowledgeBase mutation | 2026-04-22 |
| **回收站** | `trash.tsx` 完整 CRUD + 搜索过滤 + 批量选择/删除 + 确认弹窗 | 2026-04-22 |
| **文档重命名** | `RenameDialog.tsx` 独立弹窗，调用 `api.documents.update` | 2026-04-22 |
| **删除确认** | `ConfirmDialog.tsx` 通用确认弹窗，支持 destructive 样式 | 2026-04-22 |

### 🟡 AI 功能缺失

| 功能 | Web 实现 | Mobile 现状 | 优先级 | 变更 |
|---|---|---|---|---|
| **真实 AI 对话** | `/api/chat` + `/api/rag-stream` 流式 SSE + RAG + Tool Call | `ChatModal.tsx` 仍为 mock 回复（`t("Home.aiMockResponse")`），但已接入 Convex 对话存储（createConversation / addMessage / getMessages） | P0 | 部分进展 |
| **对话历史侧栏** | `ConversationSidebar.tsx` 搜索/固定/删除 | 无 | P1 | — |
| **模型选择** | `useAIModelStore.ts` 多模型切换 | 无 | P1 | — |
| **知识库 RAG 检索** | `ragUtils.ts` + Qdrant + Embeddings | 无 | P1 | — |
| **深度思考** | `useDeepThinkingStore.ts` + reasoning_content | 无 | P2 | — |
| **图片上传** | `useImageUpload.ts` + EdgeStore | 无 | P2 | — |
| **思考过程可视化** | `useThinkingProcessStore.ts` + 步骤面板 | 无 | P2 | — |
| **Web 搜索工具** | `useWebSearchStore.ts` + `webSearch.ts` | 无 | P3 | — |

---

## 二、公共包现状

### ✅ 已完成的公共化

| 模块 | 状态 | 说明 |
|---|---|---|
| **`@notion/business/utils`** | ✅ 已扩展 | `cn` + `formatTime` + `formatRelativeTime`（已走 i18n） |
| **`@notion/business/i18n`** | ✅ 已共享 | en.json / zh-CN.json / zh-TW.json |
| **`@notion/business/hooks`** | ✅ 已创建 | `useSettings` / `useSearch` / `useNavigation`，zustand 为 peerDependency |
| **`@notion/business/content-compat`** | ✅ 已创建 | BlockNote JSON ↔ HTML 双向转换（536 行），Mobile 和 Web 均可引用 |
| **`@notion/business/validation`** | ✅ 已创建 | `FileLike` 接口 + `validateImageFile` + `validateFiles`，平台无关 |
| **`@notion/convex`** | ✅ Schema 已统一 | Mobile `convex/schema.ts` 已改为 `import schema from "@notion/convex/schemas"; export default schema;` |
| **`@notion/ai`** | ✅ 已共享 | AI 配置/Prompt/RAG/Tools，仅 web 端使用 |

### 🟡 待进一步公共化

| 模块 | 现状 | 建议 |
|---|---|---|
| **`@notion/business/types`** | 已定义但两端仍直接用 Convex 生成的 `Doc<"documents">` | 可考虑逐步迁移，但 Convex 生成类型更精确，当前可接受 |
| **Web AI 相关 store** | 7 个 zustand store 仍在 `web/src/lib/store/` 本地 | `useAIModelStore` / `useDeepThinkingStore` / `useThinkingProcessStore` / `useKnowledgeBaseStore` / `useVectorStoreStore` / `useToolCallStore` / `useWebSearchStore`，待 Mobile 接入 AI 时再决定是否抽离 |
| **Web `lib/utils.ts`** | 仅剩 `getBlockNoteLocale`（web 专属） | ✅ 已精简，无需进一步操作 |

---

## 三、可优化项

### 🔴 架构级问题

| 问题 | 详情 | 状态 | 建议 |
|---|---|---|---|
| ~~Convex Schema 重复~~ | ~~mobile 手动副本~~ | ✅ 已修复 | — |
| **i18n 体系不统一** | Web 用 `next-intl`（短路径 `t("key")`），Mobile 用 `react-i18next`（全路径 `t("Namespace.key")`） | 🟡 仍存在 | 这是框架差异导致的合理分化，但公共 i18n 键的命名规范需要文档化 |
| **AI 功能仍为 mock** | Mobile ChatModal 已接入 Convex 对话存储，但 AI 回复仍为 `t("Home.aiMockResponse")` mock | 🔴 未修复 | Mobile 应通过 web 的 API 路由（`/api/chat`、`/api/rag-stream`）接入真实 AI |
| ~~编辑器格式互转丢格式~~ | ~~纯文本中转~~ | ✅ 已修复 | 已改为 HTML 双向无损转换 |

### 🟡 代码质量

| 问题 | 位置 | 状态 | 建议 |
|---|---|---|---|
| ~~`formatRelativeTime` 硬编码中文~~ | ~~`packages/business/utils/index.ts`~~ | ✅ 已修复 | — |
| ~~`content-compat.ts` 应提升为公共模块~~ | ~~mobile 本地~~ | ✅ 已修复 | — |
| ~~HomeHeader 重复渲染 changeLanguageLabel~~ | ~~`home-header.tsx`~~ | ✅ 已修复 | — |
| ~~web `lib/utils.ts` 仅做 re-export~~ | ~~`web/src/lib/utils.ts`~~ | ✅ 已修复 | — |
| ~~Mobile mock 数据残留~~ | ~~`mock/home-mock-data.ts`~~ | ✅ 已修复 | — |
| ~~Mobile 未使用的组件~~ | ~~hello-wave / parallax-scroll 等~~ | ✅ 已修复 | — |
| **Mobile 未使用 `@notion/business/hooks`** | Mobile 端未导入 `useSettings` / `useSearch` / `useNavigation` | 🟡 待接入 | Mobile 的设置/搜索/导航状态目前是组件内 useState，应迁移到共享 store |
| **Mobile `SearchModal` 未使用共享 store** | `search-modal.tsx` 用组件内 state | 🟡 待接入 | 应使用 `useSearch` store 统一管理 |
| **Web AI Chat page.tsx 超 800 行** | `web/src/app/[locale]/(main)/(AI)/Chat/page.tsx` | 🟡 仍存在 | 拆分为 `useAIChat` hook + UI 组件 |

### 🟢 性能优化

| 问题 | 状态 | 建议 |
|---|---|---|
| **web AI Chat page.tsx 超 800 行** | 🟡 仍存在 | 拆分为自定义 hook（`useAIChat`）+ UI 组件，逻辑与展示分离 |
| **web `ragUtils.ts` 重复初始化** | 🟡 仍存在 | `initKnowledgeBaseVectorStore` 每次查询都可能重新检查所有文档，应做增量检查 + 缓存 |
| **mobile `SidebarDocumentTree` 递归查询** | 🟡 仍存在 | 每层展开都发起新的 `useQuery`，深层嵌套时查询量大，可考虑一次性拉取子树 |

---

## 四、实施路线

### ~~Phase 1 — 基础对齐（消除断裂）~~ ✅ 已完成

1. ~~消除 Convex Schema 重复~~ ✅
2. ~~将 `content-compat.ts` 提升到 `@notion/business`~~ ✅
3. ~~修复 `formatRelativeTime` 硬编码中文问题~~ ✅
4. ~~清理 mobile 端模板残留文件和 mock 数据~~ ✅
5. ~~修复 HomeHeader 重复按钮~~ ✅

### ~~Phase 2 — 编辑器格式互通（P0）~~ ✅ 已完成

6. ~~研究 TenTap 的 HTML 导出能力~~ ✅ 已使用 `useEditorContent({ type: "html" })`
7. ~~在 `@notion/business/content-compat` 中实现 BlockNote JSON ↔ HTML 双向无损转换~~ ✅
8. ~~Mobile 保存时不再走纯文本中转~~ ✅ 已改为 `serializeHtmlToBlockNote`

### ~~Phase 3 — Mobile 核心功能补齐（部分）~~ ✅ 文档操作已完成

9. ~~补齐文档操作：收藏/知识库切换、重命名、删除确认~~ ✅
10. ~~补齐回收站功能~~ ✅
11. ~~Toast 反馈系统~~ ✅
12. ~~主题色改为蓝色系~~ ✅
13. ~~Modal 主题同步~~ ✅

### Phase 4 — Mobile AI 接入（当前重点）

14. **Mobile 接入真实 AI 对话** — 通过 web API 路由（`/api/chat`、`/api/rag-stream`），替换 mock 回复
15. **Mobile AI 对话历史** — 复用 Convex 的 `aiConversations` 表，实现对话列表 + 切换
16. **Mobile 模型选择** — 抽离 `useAIModelStore` 到 `@notion/business/hooks` 或 mobile 本地实现

### Phase 5 — 公共化 & 体验提升

17. **Mobile 接入 `@notion/business/hooks`** — 将设置/搜索/导航状态迁移到共享 store
18. **补齐封面图管理** — Mobile 端实现 Cover 上传/替换/删除（需解决 EdgeStore 在 RN 中的使用问题）
19. **补齐文档图标** — Mobile 端实现 emoji picker，替代当前的固定图标
20. **补齐发布功能** — Mobile 端实现 Publish popover（复制链接/公开切换）
21. **文档面包屑导航** — Mobile 端文档详情页顶部显示多级路径
22. **文档拖拽排序/移动** — Mobile 端实现长按拖拽或移动到弹窗

### Phase 6 — 性能 & 代码质量

23. **web AI Chat 页面拆分** — 提取 `useAIChat` hook，逻辑与 UI 分离
24. **web `ragUtils.ts` 增量优化** — 缓存向量存储初始化结果，增量检查文档
25. **mobile `SidebarDocumentTree` 查询优化** — 一次性拉取子树替代递归查询
26. **i18n 键命名规范文档化** — 统一 `next-intl` 和 `react-i18next` 之间的键命名规则
