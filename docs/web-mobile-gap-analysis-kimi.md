# My-Notion Web vs Mobile 架构分析报告

> 生成时间：2026-04-24
> 分析范围：全仓库架构、packages 职责、两端功能实现对比

---

## 一、整体架构概览

仓库采用 **pnpm monorepo** 结构，目标架构是「数据层统一、UI 层分离」：

| 层级 | 对应 Package / App | 职责 |
|---|---|---|
| **数据层（共享）** | `@notion/convex` | Convex Schema + Server 函数（文档/AI对话） |
| **业务逻辑层（共享）** | `@notion/business` | 类型定义、工具函数、校验逻辑、Hooks、i18n |
| **AI 能力层（共享）** | `@notion/ai` | AI 配置、Prompts、RAG、Tools、Embeddings |
| **Web 端** | `@notion/web` | Next.js 15 + BlockNote 编辑器 + EdgeStore |
| **移动端** | `@notion/mobile` | Expo 54 + Tamagui + TenTap 编辑器 + Convex Storage |

### 目录结构

```
My-Notion/
├── apps/
│   ├── web/          # Next.js 15 应用
│   └── mobile/       # Expo 54 应用
├── packages/
│   ├── ai/           # AI 能力（配置/Prompts/RAG/Tools）
│   ├── business/     # 共享业务逻辑（类型/工具/校验/Hooks/i18n）
│   └── convex/       # Convex Schema + Server 函数
└── docs/
    └── web-mobile-gap-analysis.md   # 历史差距分析文档
```

---

## 二、已实现的部分（做得好的）

### 1. 数据层完全共享

- **Schema 统一**：`apps/mobile/convex/schema.ts` 和 `apps/web/convex/schema.ts` 都是 `import schema from "@notion/convex/schemas"` 的 re-export，零重复
- **Convex 函数共享**：`@notion/convex` 提供了完整的文档操作（archive/create/update/move/remove/restore/star/knowledgeBase）和 AI 对话操作（createConversation/addMessage/getMessages 等）
- **两端直接消费同一套 Convex API**，数据一致性有保障

### 2. 业务逻辑公共化

| 模块 | 内容 | 两端使用情况 |
|---|---|---|
| `@notion/business/types` | `Document`, `AIConversation`, `AIMessage` 等 | Web 仍偏向用 Convex 生成的 `Doc<"documents">`，Mobile 直接用 |
| `@notion/business/utils` | `cn()`, `formatTime()`, `formatRelativeTime()` | 两端都在用 |
| `@notion/business/validation` | `FileLike` 接口、`validateCoverImage()`、`validateFiles()` | Web（EdgeStore）和 Mobile（Convex Storage）共用同一套校验 |
| `@notion/business/content-compat` | BlockNote JSON ↔ HTML 双向转换（536 行） | **核心公共模块**，解决两端编辑器格式互通 |
| `@notion/business/hooks` | `useSettings`, `useSearch`, `useNavigation` | Web 在用，Mobile 尚未接入 |
| `@notion/business/i18n` | `en.json`, `zh-CN.json`, `zh-TW.json` | 两端共用同一套翻译文件 |

### 3. AI 能力公共化

- `@notion/ai` 包含：AI 模型配置、Prompts、RAG（Qdrant 向量存储）、Tools（Web Search）、Embeddings
- 目前 **仅 Web 端在使用**，但模块本身已做好跨端准备

### 4. 移动端核心文档功能已补齐

- 文档 CRUD、收藏、知识库切换、回收站（含批量删除）、重命名、删除确认
- 封面图上传（通过 `expo-image-picker` + Convex Storage，独立实现）
- 面包屑导航、Toast 反馈系统、主题切换、语言切换

---

## 三、尚未完成 / 需要改进的部分

### 1. AI 对话功能 — Mobile 仍为 Mock（P0）

| Web 端 | Mobile 端 | 差距 |
|---|---|---|
| `/api/chat` + `/api/rag-stream` 流式 SSE | `ChatModal.tsx` 里 AI 回复是 `t("Home.aiMockResponse")` mock | **核心功能未接通** |
| RAG 检索（Qdrant + Embeddings） | 无 | Mobile 无法使用知识库 |
| 模型选择、深度思考、工具调用 | 无 | 无 AI 能力配置 |
| 对话历史侧栏（搜索/固定/删除） | 仅显示消息列表，无对话管理 UI | 体验差距大 |

**建议**：Mobile 通过调用 Web 的 API 路由（`/api/chat`、`/api/rag-stream`）接入真实 AI，复用 `@notion/ai` 的 Prompt 和配置。

### 2. 编辑器能力差距

| 能力 | Web | Mobile |
|---|---|---|
| 编辑器 | BlockNote（功能完整） | TenTap（基础富文本） |
| 图片上传 | ✅ EdgeStore 集成 | ❌ 未实现 |
| 格式互通 | ✅ 通过 `content-compat` | ✅ 已接入 |

Mobile 编辑器目前只支持基础富文本，且**无法上传图片到文档内容中**。

### 3. 公共 Hooks 未在 Mobile 落地

- `@notion/business/hooks` 提供了 `useSettings` / `useSearch` / `useNavigation`
- Mobile 目前仍是组件内 `useState` 管理这些状态，未接入共享 store
- 导致两端状态管理范式不一致

### 4. i18n 体系分化

| 维度 | Web | Mobile |
|---|---|---|
| 框架 | `next-intl` | `react-i18next` |
| 键风格 | `t("key")` 短路径 | `t("Namespace.key")` 全路径 |
| 翻译文件 | 共用 `@notion/business/i18n` | 共用 `@notion/business/i18n` |

虽然共用翻译文件，但**调用风格不统一**，维护时需要同时适配两种范式。

### 5. Web 端独有功能（Mobile 不需要或有替代）

| 功能 | Web | Mobile 是否需要 |
|---|---|---|
| 发布/预览（`isPublished` + `/preview` 路由） | ✅ 完整 | 不需要（但 Mobile 文档详情页有「复制链接」按钮，指向 Web 预览页） |
| Marketing 落地页 | ✅ `(marketing)` 路由 | 不需要 |
| 文档拖拽排序 | ✅ 原生 Drag & Drop | 低优先级（可用「移动到」替代） |

### 6. 代码质量与架构债务

| 问题 | 位置 | 建议 |
|---|---|---|
| Web AI Chat 页面超 800 行 | `web/.../Chat/page.tsx` | 拆分为 `useAIChat` hook + UI 组件 |
| Mobile `SidebarDocumentTree` 递归查询 | `sidebar-document-tree.tsx` | 每层展开都发 `useQuery`，深层嵌套时性能差 |
| RAG 向量存储重复初始化 | `ragUtils.ts` | 应做增量检查 + 缓存 |
| AI Store 未公共化 | `web/src/lib/store/` 下 7 个 zustand store | 待 Mobile 接入 AI 时，评估是否抽离到 `@notion/business` |

---

## 四、功能对比矩阵

| 功能模块 | Web | Mobile | 共享层 | 状态 |
|---|---|---|---|---|
| **文档 CRUD** | ✅ | ✅ | `@notion/convex/documents` | 已完成 |
| **文档树/侧边栏** | ✅ | ✅ | `@notion/convex/documents` | 已完成 |
| **收藏/知识库** | ✅ | ✅ | `@notion/convex/documents` | 已完成 |
| **回收站** | ✅ | ✅ | `@notion/convex/documents` | 已完成 |
| **封面图** | ✅ EdgeStore | ✅ Convex Storage | `@notion/business/validation` | 已完成（上传方式不同） |
| **文档图标** | ✅ Emoji Picker | ⚠️ 固定图标 | — | 需补齐 Emoji Picker |
| **编辑器** | ✅ BlockNote | ⚠️ TenTap 基础版 | `@notion/business/content-compat` | 格式互通已完成 |
| **编辑器图片上传** | ✅ | ❌ | — | Mobile 缺失 |
| **AI 对话** | ✅ 流式+RAG+Tool | ❌ Mock 回复 | `@notion/ai` | **核心差距** |
| **AI 对话历史** | ✅ 侧栏管理 | ⚠️ 仅显示消息 | `@notion/convex/chat` | 需补齐 |
| **模型选择** | ✅ | ❌ | `@notion/ai/config` | 需补齐 |
| **知识库 RAG** | ✅ Qdrant | ❌ | `@notion/ai/rag` | 需补齐 |
| **发布/预览** | ✅ | 不需要 | — | — |
| **设置** | ✅ Modal | ✅ Popover | `@notion/business/hooks` | Mobile 未接入共享 store |
| **搜索** | ✅ Command Palette | ✅ Modal | `@notion/business/hooks` | Mobile 未接入共享 store |
| **主题切换** | ✅ next-themes | ✅ AsyncStorage | — | 独立实现 |
| **语言切换** | ✅ next-intl | ✅ react-i18next | `@notion/business/i18n` | 共用翻译文件 |
| **Toast/反馈** | ✅ sonner | ✅ 自定义 Toast | — | 独立实现 |

---

## 五、Packages 详细分析

### `@notion/convex`

**职责**：Convex Schema 定义 + Server 端函数（Queries / Mutations）

**导出**：
- `schemas` — 数据库表定义（documents, aiConversations, aiMessages, aiThinkingSteps）
- `documents` — 文档相关 Convex 函数（18 个操作）
- `chat` — AI 对话相关 Convex 函数（11 个操作）
- `client` — Convex 客户端配置

**两端使用方式**：
- Web：`import { api } from "@/convex/_generated/api"`
- Mobile：`import { api } from "@convex/_generated/api"`

**状态**：✅ 完全共享，Schema 已统一

### `@notion/business`

**职责**：共享业务逻辑、类型、工具、校验、Hooks、i18n

**导出**：
- `/` — 统一导出 Types + Utils
- `types` — TypeScript 接口（Document, AIConversation, AIMessage, AIThinkingStep）
- `utils` — `cn()`, `formatTime()`, `formatRelativeTime()`
- `validation` — `FileLike` 接口、图片校验逻辑、封面图上传抽象
- `hooks` — `useSettings`, `useSearch`, `useNavigation`（zustand store）
- `content-compat` — BlockNote JSON ↔ HTML 双向转换
- `i18n/*` — 翻译文件（en, zh-CN, zh-TW）

**状态**：
- ✅ 类型、工具、校验、格式兼容已共享
- ⚠️ Hooks 尚未在 Mobile 落地
- ⚠️ i18n 调用风格两端不一致

### `@notion/ai`

**职责**：AI 能力抽象，与平台无关

**导出**：
- `config` — AI 模型配置、BaseURL、模型映射
- `prompts` — 系统 Prompts 加载器
- `tools` — Tool 定义（Web Search）+ Tool 注册表
- `embeddings` — 自定义 Embeddings 实现
- `rag` — Qdrant 向量存储封装
- `utils` — AI 相关工具函数

**状态**：
- ✅ 模块已做好跨端准备
- ❌ 目前仅 Web 端使用

---

## 六、总结与建议

### 已实现的部分

1. **数据层完全统一** — Schema、Convex Server 函数、API 调用方式两端一致
2. **核心业务逻辑已抽离** — `@notion/business` 覆盖了类型、工具、校验、格式兼容、Hooks
3. **AI 能力已模块化** — `@notion/ai` 准备好跨端使用
4. **Mobile 基础文档功能已补齐** — 编辑、收藏、回收站、封面图、面包屑等

### 最关键的差距

1. **Mobile AI 对话仍是 Mock** — 这是当前最大的功能断裂，需要接入 Web 的 `/api/chat` 和 `/api/rag-stream`
2. **Mobile 编辑器无法上传图片** — TenTap 的图片上传能力需要补充
3. **公共 Hooks 未在 Mobile 落地** — `useSettings`/`useSearch`/`useNavigation` 需要接入

### 下一步建议优先级

| 优先级 | 事项 | 说明 |
|---|---|---|
| **P0** | Mobile 接入真实 AI 对话 | 调用 Web API 路由 `/api/chat`、`/api/rag-stream` |
| **P1** | 补齐 Mobile 对话历史管理 UI | 复用 Convex `aiConversations` 表 |
| **P1** | Mobile 接入 `@notion/business/hooks` | 统一设置/搜索/导航状态管理 |
| **P2** | Mobile 编辑器图片上传 | TenTap 图片上传能力 |
| **P2** | Web AI Chat 页面拆分 | 提取 `useAIChat` hook，逻辑与 UI 分离 |
| **P2** | RAG 向量存储增量优化 | 缓存初始化结果，避免重复检查 |

---

> 本报告基于仓库当前状态（2026-04-24）生成，与已有的 `web-mobile-gap-analysis.md` 互为补充。
