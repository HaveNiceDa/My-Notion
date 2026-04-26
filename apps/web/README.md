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
- 🤖 **RAG 增强问答** — 基于用户文档知识库的精准问答，Qdrant 向量检索 + 余弦相似度匹配
- 💬 **流式响应** — NDJSON / SSE 双协议流式输出，实时渲染 AI 回复
- 🧠 **深度思考** — AI 思考过程可视化，展示推理链路
- 🔧 **工具调用** — Web 搜索等智能工具调用系统
- 📚 **增量更新** — SHA-256 内容哈希 + 向量存储缓存，避免重复嵌入
- 💾 **持久化对话** — 用户隔离的对话历史，自动标题更新

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
│   │       ├── chat/              # AI 对话 API
│   │       ├── edgestore/         # 文件存储代理
│   │       ├── embeddings/        # 向量嵌入 API
│   │       ├── qdrant/            # Qdrant 操作 API
│   │       ├── rag-stream/        # RAG 流式 API
│   │       ├── rag-complete/      # RAG 完整响应 API
│   │       ├── rag-documents/     # RAG 文档管理 API
│   │       └── upload-image/      # 图片上传代理 (CORS)
│   ├── components/                # 可复用组件
│   │   ├── modals/                # 弹窗组件
│   │   ├── providers/             # Provider 组件
│   │   └── ui/                    # Shadcn UI 组件
│   ├── hooks/                     # 自定义 Hooks
│   ├── i18n/                      # next-intl 配置
│   ├── lib/
│   │   ├── convex/                # Convex 客户端
│   │   ├── rag/                   # RAG 工具函数
│   │   ├── store/                 # Zustand 状态 (Web 专属)
│   │   ├── edgestore.ts           # EdgeStore Provider
│   │   └── utils.ts               # 通用工具
│   ├── instrumentation.ts         # Sentry 初始化
│   └── proxy.ts                   # API 代理配置
├── convex/                        # Convex 后端 (入口导出 @notion/convex)
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

## 注意事项

- **React 19 严格模式**：BlockNote 尚不兼容 StrictMode，已在 `next.config.js` 中禁用
- **Turbopack**：开发模式默认使用 Turbopack，`@next/bundle-analyzer` 需使用 `--webpack` 标志
- **Clerk 配置**：确保 JWT 颁发者域与 Convex 认证配置一致
