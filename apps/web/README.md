# My-Notion Web

基于 Next.js 16 + React 19 的全栈 Notion 克隆 Web 应用，集成 AI 对话、RAG 知识库检索、实时协作编辑等能力。

## 🚀 体验地址

[https://notion-j9zj.vercel.app/](https://notion-j9zj.vercel.app/)

## 📸 项目截图

### 首页（亮色主题）
![首页-亮色主题](public/screenshots/1.png)

### 首页（暗黑主题）
![首页-暗黑主题](public/screenshots/2.png)

### 文档编辑页面
![文档编辑页面](public/screenshots/3.png)

### AI 聊天页面
![AI 聊天页面](public/screenshots/4.png)

### AI 思考过程可视化
![AI 思考过程可视化](public/screenshots/5.png)
![AI 思考过程可视化](public/screenshots/6.png)

## ✨ 核心特性

### 文档编辑
- 📝 **BlockNote 富文本编辑器** — 支持多种内容块格式，动态导入优化首屏加载
- 📁 **文档管理** — 创建、编辑、归档、删除、收藏、搜索
- 🎨 **封面图 & 图标** — 支持自定义封面和 Emoji 图标（emoji-picker-react 动态导入，~800KB 按需加载）
- 📤 **文档发布** — 支持文档公开分享与预览

### AI 智能对话
- 🤖 **Agent ReAct 循环** — LLM 自主决策 `knowledge_search` / `web_search` / `document_read` 工具调用，支持多轮推理与多工具并行
- 🤖 **RAG 增强问答** — 基于用户文档知识库的精准问答，Qdrant 向量检索 + 余弦相似度匹配
- 💬 **流式响应** — NDJSON / SSE 双协议流式输出，实时渲染 AI 回复
- 🧠 **深度思考** — AI 思考过程可视化，展示推理链路
- 🔧 **工具调用** — 知识库检索、SerpAPI Google Search、当前文档读取等智能工具调用系统
- 📚 **增量更新** — SHA-256 内容哈希 + 向量存储缓存，避免重复嵌入
- 💾 **持久化对话** — 用户隔离的对话历史，自动标题更新
- 🛡️ **稳定性增强** — 内存滑动窗口限流、环境变量启动校验、工具结果 LRU/TTL 缓存、Qdrant 不可用时优雅降级

### 编辑器 AI（@blocknote/xl-ai）
- ✍️ **选中即 AI** — 选中文字后弹出 BlockNote 官方 AI 菜单，支持 Improve Writing、Fix Spelling、Translate、Simplify
- 🧩 **共享服务端逻辑** — 编辑器 AI 服务端逻辑抽到 `packages/ai/server/editor-ai`，与侧边栏 Agent 解耦
- 🌐 **三语菜单** — AI 操作菜单接入中/英/繁体国际化
- 🔧 **格式化工具栏 AI** — 工具栏集成 AI 按钮，选中文字即可触发
- /️ **斜杠菜单 AI** — 输入 `/` 触发 AI 相关操作项

### CLI 机器 API
- 🔐 **PAT Token 管理** — `POST/GET/DELETE /api/cli/tokens` 支持登录态创建、列出和撤销 My-Notion CLI PAT
- 🌐 **Convex HTTP Actions** — `/cli/v1/auth/status` 与 `/cli/v1/documents*` 提供 Bearer Token 机器访问接口
- 📄 **文档自动化** — 外部 CLI/Agent 可通过 HTTP Actions 创建、读取、搜索、列表和更新文档
- 🧪 **端到端验证** — `pnpm e2e:cli` 自动创建测试 PAT、执行文档流程并在结束时撤销 PAT

### 工程化
- 🔒 **CI/CD 闭环** — GitHub Actions 自动化：Build + Lint + TypeCheck + Unit Test + E2E
- 📊 **Bundle 优化** — @next/bundle-analyzer 分析 + 动态导入重型组件（emoji-mart、BlockNote）
- 🐛 **Sentry 监控** — 全链路错误追踪 + Source Map 上传 + 性能监控
- 🧪 **测试覆盖** — Vitest 单元测试（67+ 用例）+ Playwright E2E 测试
- 🌐 **国际化** — next-intl 集成，中/英/繁体三语，PascalCase 命名规范

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **框架** | Next.js (Turbopack) | 16 |
| **UI 库** | React | 19 |
| **语言** | TypeScript | 5.x |
| **样式** | Tailwind CSS + Shadcn UI | 3.x |
| **编辑器** | BlockNote | 0.41 |
| **认证** | Clerk | 7.x |
| **数据库** | Convex | 1.31+ |
| **文件存储** | EdgeStore | 0.6 |
| **AI** | LangChain + OpenAI SDK | — |
| **向量数据库** | Qdrant | — |
| **机器 API** | Convex HTTP Actions + PAT Token | — |
| **状态管理** | Zustand | 5.x |
| **国际化** | next-intl | 4.x |
| **监控** | Sentry | 10.x |
| **测试** | Vitest + Playwright | — |

## 快速开始

### 前提条件
- Node.js 22.0+
- pnpm 10+
- Convex 账号
- Clerk 账号
- EdgeStore 账号
- Qdrant 账号（用于 RAG）

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/HaveNiceDa/My-Notion.git
   cd My-Notion
   pnpm i
   ```

2. **配置环境变量**
   在 `apps/web/` 下创建 `.env.local` 文件：
   ```env
   # Convex
   CONVEX_DEPLOYMENT=your-convex-deployment
   NEXT_PUBLIC_CONVEX_URL=your-convex-url
   NEXT_PUBLIC_CONVEX_SITE_URL=your-convex-site-url

   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
   CLERK_SECRET_KEY=your-clerk-secret-key
   CLERK_JWT_ISSUER_DOMAIN=your-clerk-jwt-issuer-domain

   # EdgeStore
   EDGE_STORE_ACCESS_KEY=your-edge-store-access-key
   EDGE_STORE_SECRET_KEY=your-edge-store-secret-key

   # Qdrant
   NEXT_PUBLIC_QDRANT_URL=your-qdrant-url
   NEXT_PUBLIC_QDRANT_API_KEY=your-qdrant-api-key

   # LLM
   LLM_API_KEY=your-llm-api-key

   # Web Search
   SERPAPI_API_KEY=your-serpapi-api-key

   # Sentry (可选)
   SENTRY_ORG=your-sentry-org
   SENTRY_PROJECT=your-sentry-project
   SENTRY_AUTH_TOKEN=your-sentry-auth-token
   ```

3. **启动开发服务器**
   ```bash
   cd apps/web
   pnpm start
   ```
   应用将在 `http://localhost:3000` 运行。

### 常用验证

```bash
# Web 类型检查
pnpm --filter @notion/web exec tsc --noEmit

# Web Lint
pnpm --filter @notion/web lint

# Web 构建
pnpm --filter @notion/web build

# CLI + Convex HTTP Actions 端到端验证
pnpm e2e:cli
```

## 项目结构

```
web/
├── src/
│   ├── app/
│   │   ├── [locale]/              # 国际化路由
│   │   │   ├── (main)/            # 主应用
│   │   │   │   ├── (AI)/Chat/     # AI 对话模块
│   │   │   │   ├── (routes)/      # 文档路由
│   │   │   │   └── _components/   # 主应用组件
│   │   │   ├── (marketing)/       # 营销落地页
│   │   │   └── (public)/          # 公开预览页
│   │   └── api/                   # API 路由
│   │       ├── agent/stream       # Agent ReAct NDJSON 流式 API
│   │       ├── cli/tokens         # My-Notion CLI PAT 创建/列表/撤销
│   │       ├── editor-ai/         # 编辑器 AI API (BlockNote AI Transport)
│   │       ├── edgestore/         # 文件存储代理
│   │       ├── rag-documents/     # RAG 文档管理 API
│   │       └── upload-image/      # 图片上传代理 (CORS)
│   ├── components/                # 可复用组件
│   │   ├── modals/                # 弹窗组件
│   │   ├── providers/             # Provider 组件
│   │   └── ui/                    # Shadcn UI 组件
│   ├── hooks/                     # 自定义 Hooks
│   ├── i18n/                      # next-intl 配置
│   ├── lib/
│   │   ├── agent/                 # Agent ReAct Loop、工具注册、流式协议、限流和缓存
│   │   ├── convex/                # Convex 客户端
│   │   ├── rag/                   # RAG 工具函数
│   │   ├── store/                 # Zustand 状态 (Web 专属)
│   │   ├── edgestore.ts           # EdgeStore Provider
│   │   └── utils.ts               # 通用工具
│   ├── instrumentation.ts         # Sentry 初始化
│   └── proxy.ts                   # API 代理配置
├── convex/                        # Convex 后端入口，含 http.ts 暴露 /cli/v1/* HTTP Actions
├── public/                        # 静态资源
├── next.config.js                 # Next.js + Sentry + Bundle Analyzer
├── eslint.config.mjs              # ESLint Flat Config
└── sentry.*.config.ts             # Sentry 配置
```

## 性能优化

| 优化项 | 策略 | 效果 |
|--------|------|------|
| emoji-picker-react | `next/dynamic` 懒加载 | ~800KB 拆分为独立 chunk |
| BlockNote / TipTap | 页面级动态导入 | 编辑器仅文档页加载 |
| Sentry | `removeDebugLogging` tree-shaking | 移除调试日志代码 |
| @blocknote/core | `optimizePackageImports` | 按需导入减少 bundle |

## 🗺️ Roadmap

### ✅ 已完成

- **编辑器 AI** — 基于 `@blocknote/xl-ai`，选中文字可翻译（中/英）、润色、扩写、缩写；光标处可续写、生成大纲、总结内容
- **Agent ReAct 循环** — AI 侧边栏已切换为 LLM 自主工具调用，支持知识库检索、联网搜索和文档读取
- **SerpAPI 联网搜索** — 替换 DashScope 内置搜索，返回结构化标题、链接和摘要，提升结果可验证性
- **CLI 机器 API** — 支持 PAT Token、Convex HTTP Actions、CLI 文档自动化和 E2E 自动撤销测试 PAT
- **AI 服务 Edge Runtime 迁移** — 从 Hono Serverless 迁移至 Vercel 原生 Edge Function，解决 DashScope 超时问题

### 🎯 AI 编辑器增强

- **AI 操作历史** — 记录每次 AI 修改，支持一键撤销/重做 AI 变更
- **Inline AI Assist** — 行内 AI 建议，输入 `/ai` 触发 AI 辅助，类似 Copilot 的实时补全体验

### 🚀 RAG 能力增强

从"能用"到"好用"的 RAG 进化：

- **分层检索** — 粗筛 + 精排两阶段，提升召回率和准确率
- **混合检索** — 向量检索 + BM25 关键词检索融合
- **多格式入库** — PDF、Markdown、Word 直接解析入库
- **溯源验证** — 展示 RAG 引用的文档片段，支持点击跳转原文

## 注意事项

- **React 19 严格模式**：BlockNote 尚不兼容 StrictMode，已在 `next.config.js` 中禁用
- **Turbopack**：开发模式默认使用 Turbopack，`@next/bundle-analyzer` 需使用 `--webpack` 标志
- **Clerk 配置**：确保 JWT 颁发者域与 Convex 认证配置一致
- **CLI API URL**：My-Notion CLI 需要使用 Convex `.site` URL，而不是 `.cloud` API URL
