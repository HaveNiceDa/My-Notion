# Web vs Mobile 功能差异与优化方案

> 扫描时间：2026-04-21

## 一、功能对比矩阵

### 🔴 Web 有但 Mobile 缺失的功能

| 功能 | Web 实现 | Mobile 现状 | 优先级 |
|---|---|---|---|
| **编辑器格式互通优化** | BlockNote (`@blocknote/react`)，原生 JSON 存储 | TenTap (`@10play/tentap-editor`)，通过 `content-compat.ts` 做格式互转，但保存时先提取纯文本再序列化为 BlockNote JSON，富文本格式（加粗/列表等）会丢失 | P0 |
| **封面图管理** | `Cover.tsx` + EdgeStore 上传/替换/删除 | 无 | P1 |
| **文档图标** | `Toolbar.tsx` + `icon-picker.tsx` | 无 | P1 |
| **发布/取消发布** | `Publish.tsx` 完整 popover | 无 | P1 |
| **收藏/知识库切换** | `Publish.tsx` 中的 Star / KnowledgeBase 按钮 | 列表可展示，但无操作入口 | P1 |
| **回收站** | `TrashBox.tsx` 完整 CRUD + 批量删除 | 无 | P1 |
| **文档拖拽排序/移动** | `Item.tsx` 原生 Drag & Drop | 无 | P2 |
| **面包屑导航** | `Title.tsx` 多级路径 + 省略折叠 | 无 | P2 |
| **设置弹窗** | `SettingsModal.tsx` 外观 + 语言 | 散落在 HomeHeader 的 Popover 中 | P2 |
| **文档重命名** | `RenameModal.tsx` 独立弹窗 | 无 | P2 |
| **删除确认** | `ConfirmModal.tsx` | 无 | P2 |
| **Marketing 落地页** | `(marketing)` 路由组 | 无（移动端不需要） | — |

### 🟡 AI 功能缺失

| 功能 | Web 实现 | Mobile 现状 | 优先级 |
|---|---|---|---|
| **真实 AI 对话** | `/api/chat` 流式 SSE + RAG + Tool Call | `ChatModal.tsx` 仅 mock 回复 | P0 |
| **对话历史侧栏** | `ConversationSidebar.tsx` 搜索/固定/删除 | 无 | P1 |
| **模型选择** | `useAIModelStore.ts` 多模型切换 | 无 | P1 |
| **知识库 RAG 检索** | `ragUtils.ts` + Qdrant + Embeddings | 无 | P1 |
| **深度思考** | `useDeepThinkingStore.ts` + reasoning_content | 无 | P2 |
| **图片上传** | `useImageUpload.ts` + EdgeStore | 无 | P2 |
| **思考过程可视化** | `useThinkingProcessStore.ts` + 步骤面板 | 无 | P2 |
| **Web 搜索工具** | `useWebSearchStore.ts` + `webSearch.ts` | 无 | P3 |

---

## 二、可抽离为公共代码的部分

### 已有公共包但未充分利用

| 模块 | 现状 | 建议 |
|---|---|---|
| **`@notion/business/utils`** | 仅有 `cn` + `formatTime` + `formatRelativeTime` | 扩展为共享工具集（见下） |
| **`@notion/business/i18n`** | ✅ 已共享 | — |
| **`@notion/business/types`** | ✅ 已定义 Document/AI 类型 | 但两端都直接用 Convex 生成的 `Doc<"documents">`，未引用此类型 |
| **`@notion/convex`** | ✅ 共享 Convex 函数 | 但 mobile 端复制了 schema 到本地 `convex/schema.ts`（注释也承认了同步问题） |
| **`@notion/ai`** | ✅ 共享 AI 配置/Prompt/RAG/Tools | 仅 web 端使用，mobile 未接入 |

### 建议新增/扩展的公共模块

| 模块 | 来源 | 说明 |
|---|---|---|
| **`@notion/business/hooks`** | web 的 `useSettings`, `useSearch`, `useNavigation` 等 zustand store | 这些状态逻辑与平台无关，mobile 端也需要同样的 store 模式 |
| **`@notion/business/format`** | `formatTime` + `formatRelativeTime` 合并 | 当前 `formatRelativeTime` 硬编码中文字符串，应走 i18n |
| **`@notion/business/validation`** | web 的 `file-validation.ts` | 图片类型校验逻辑平台无关 |
| **`@notion/business/content-compat`** | mobile 的 `content-compat.ts` | BlockNote ↔ TenTap 格式互转是跨端数据互通的核心，应放到公共包 |

---

## 三、可优化项

### 🔴 架构级问题

| 问题 | 详情 | 建议 |
|---|---|---|
| **Convex Schema 重复** | mobile 的 `convex/schema.ts` 是 `@notion/convex/schemas` 的手动副本，注释也承认同步风险 | 让 mobile 的 `convex/schema.ts` 直接 re-export `@notion/convex/schemas`；如果 Convex 限制跨包引用，至少加个 CI 校验脚本对比两份 schema 是否一致 |
| **i18n 体系不统一** | Web 用 `next-intl`（命名空间短路径 `t("key")`），Mobile 用 `react-i18next`（全路径 `t("Namespace.key")`） | 这是框架差异导致的合理分化，但公共 i18n 键的命名规范需要文档化，避免再出现 `Common.cancel` vs `Modals.confirm.cancel` 的问题 |
| **AI 功能完全断裂** | Mobile 的 ChatModal 是纯 mock，与 web 的完整 AI 管线无交集 | Mobile 应通过 web 的 API 路由（`/api/chat`、`/api/rag-stream`）接入 AI，而非在 Convex 中实现。这需要 mobile 能访问 web 的部署 URL |
| **编辑器格式互转丢格式** | Mobile TenTap 保存时通过 `useEditorContent({ type: "text" })` 提取纯文本，再用 `serializePlainTextToBlockNote` 转为 BlockNote JSON，加粗/列表/链接等富文本格式全部丢失 | 应改为 TenTap 导出 HTML 或 ProseMirror JSON，再在 `content-compat.ts` 中实现 BlockNote JSON ↔ HTML/ProseMirror JSON 的双向无损转换 |

### 🟡 代码质量

| 问题 | 位置 | 建议 |
|---|---|---|
| **`formatRelativeTime` 硬编码中文** | `packages/business/utils/index.ts` | 应接收 `t` 函数参数，与 `formatTime` 保持一致 |
| **`content-compat.ts` 应提升为公共模块** | `mobile/app/src/features/documents/content-compat.ts` | BlockNote ↔ TenTap 格式互转是跨端数据互通的核心，应放到 `@notion/business` |
| **HomeHeader 重复渲染 changeLanguageLabel** | `mobile/.../home-header.tsx` Popover 中 | Popover 里有两个 `changeLanguageLabel` 按钮（一个误写），应删掉重复的那个 |
| **web `lib/utils.ts` 仅做 re-export** | `web/src/lib/utils.ts` | 只 re-export `cn` + `formatTime` + 一个 `getBlockNoteLocale`，`getBlockNoteLocale` 是 web 专属，其余应直接从 `@notion/business/utils` 导入 |
| **Mobile mock 数据残留** | `mobile/.../mock/home-mock-data.ts` | 已接入真实 Convex 数据，mock 文件可删除 |
| **Mobile 未使用的组件** | `hello-wave.tsx`, `parallax-scroll-view.tsx`, `haptic-tab.tsx`, `external-link.tsx` | 来自 Expo 模板，当前无引用，可清理 |

### 🟢 性能优化

| 问题 | 建议 |
|---|---|
| **web AI Chat page.tsx 超 800 行** | 拆分为自定义 hook（`useAIChat`）+ UI 组件，逻辑与展示分离 |
| **web `ragUtils.ts` 重复初始化** | `initKnowledgeBaseVectorStore` 每次查询都可能重新检查所有文档，应做增量检查 + 缓存 |
| **mobile `SidebarDocumentTree` 递归查询** | 每层展开都发起新的 `useQuery`，深层嵌套时查询量大，可考虑一次性拉取子树 |

---

## 四、实施路线

### Phase 1 — 基础对齐（消除断裂）

1. 消除 Convex Schema 重复，mobile 直接引用 `@notion/convex/schemas`
2. 将 `content-compat.ts` 提升到 `@notion/business`
3. 修复 `formatRelativeTime` 硬编码中文问题
4. 清理 mobile 端模板残留文件和 mock 数据
5. 修复 HomeHeader 重复按钮

### Phase 2 — 编辑器格式互通（P0）

6. 研究 TenTap 的 `useEditorContent({ type: "html" })` 或 ProseMirror JSON 导出能力
7. 在 `@notion/business/content-compat` 中实现 BlockNote JSON ↔ HTML 双向无损转换
8. Mobile 保存时不再走纯文本中转，直接输出 BlockNote 兼容格式

### Phase 3 — Mobile 核心功能补齐

9. Mobile 接入真实 AI 对话（通过 web API 路由）
10. 补齐文档操作：收藏/知识库切换、重命名、删除确认
11. 补齐回收站功能
12. 补齐封面图 + 图标管理

### Phase 4 — 公共化 & 体验提升

13. 抽离 zustand store 到 `@notion/business/hooks`
14. Mobile AI 对话历史侧栏 + 模型选择
15. 文档面包屑导航
16. web AI Chat 页面拆分重构
