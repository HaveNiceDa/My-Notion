# My-Notion

全栈 AI 驱动的 Notion 克隆应用 — 覆盖 Web、Mobile 双端，采用 Monorepo 架构实现跨端代码共享与工程化闭环。

## ✨ 项目亮点

- 🏗️ **全栈 Monorepo** — pnpm workspace 统一管理 Web / Mobile / AI Service / 共享包，一套代码多端复用
- 🤖 **RAG 增强对话** — 基于 Qdrant 向量检索 + LangChain 的文档知识库问答，支持流式响应、深度思考、工具调用
- 📱 **跨端架构收敛** — AI 状态（Zustand）、Convex 业务逻辑、i18n 翻译均抽离至共享包，Web/Mobile 零重复
- ⚡ **最新技术栈** — Next.js 16 (Turbopack) / React 19 / Expo 54 / TypeScript 5.9 / Hono
- 🔒 **工程化闭环** — GitHub Actions CI/CD（Build + Lint + TypeCheck + Unit Test + E2E）、Sentry 错误监控、Bundle 优化
- 🌐 **全栈国际化** — next-intl (Web) + i18next (Mobile)，中/英/繁体三语支持，PascalCase 命名规范

## 📦 项目结构

```
My-Notion/
├── apps/
│   ├── web/                    # Next.js 16 Web 应用 (Turbopack)
│   └── mobile/                 # Expo 54 移动应用 (React Native 0.81)
├── packages/
│   ├── ai/                     # AI 核心包 — RAG、Embeddings、Chat、Tools
│   ├── business/               # 业务共享包 — Zustand Stores、i18n、Types、Utils
│   └── convex/                 # Convex 共享逻辑 — Schemas、Documents、Chat
├── services/
│   └── ai/                     # Hono AI 网关服务 — API Key 代理 + Sentry 监控
├── tests/                      # Playwright E2E 测试
├── vitest.config.ts            # Vitest 单元测试配置
└── playwright.config.ts        # Playwright E2E 配置
```

## 🏗️ 架构设计

### 跨端共享层

| 共享包 | 职责 | 被依赖方 |
|--------|------|----------|
| `@notion/ai` | RAG 检索、Embeddings、流式 Chat、工具调用 | Web + Mobile + AI Service |
| `@notion/business` | Zustand Stores（AI 模型/知识库/深度思考）、i18n、类型校验 | Web + Mobile |
| `@notion/convex` | Convex Schema、Documents/Chat 业务逻辑（超集版） | Web + Mobile |

### AI 架构

```
用户输入 → Web/Mobile UI
  → Hono AI Service (API Key 代理)
    → @notion/ai (RAG + Chat + Tools)
      → Qdrant 向量检索 + LLM API
```

### 工程化体系

```
代码提交 → GitHub Actions
  ├─ Build (Web + AI Service)
  ├─ Lint + TypeCheck + Unit Tests (Vitest, 67+ 用例)
  └─ E2E Tests (Playwright)
→ Vercel 自动部署
→ Sentry 线上监控
```

## 🚀 快速开始

### 前提条件

- Node.js 22.0+
- pnpm 10+

### 安装

```bash
pnpm i
```

### 开发

```bash
# Web 应用
cd apps/web && pnpm start

# 移动应用
cd apps/mobile && pnpm start

# AI 网关服务
cd services/ai && pnpm dev
```

### 构建

```bash
pnpm build:web
```

### 测试

```bash
# 单元测试
pnpm test

# E2E 测试（需先启动 dev server）
pnpm exec playwright test
```

## 🛠️ 技术栈总览

| 层级 | 技术 |
|------|------|
| **Web 框架** | Next.js 16 (Turbopack) / React 19 |
| **Mobile 框架** | Expo 54 / React Native 0.81 / Tamagui 2.0 |
| **AI/LLM** | LangChain / OpenAI SDK / 通义千问 / Qdrant |
| **后端/数据库** | Convex (实时数据库) / EdgeStore (文件存储) |
| **AI 网关** | Hono / Node.js |
| **认证** | Clerk |
| **状态管理** | Zustand 5 |
| **编辑器** | BlockNote 0.41 / TipTap (TenTap) |
| **国际化** | next-intl (Web) / i18next (Mobile) |
| **样式** | Tailwind CSS + Shadcn UI (Web) / Tamagui (Mobile) |
| **测试** | Vitest (单元) / Playwright (E2E) |
| **监控** | Sentry |
| **CI/CD** | GitHub Actions |
| **部署** | Vercel |

## 📝 各应用说明

- [Web 应用](./apps/web/README.md) — 基于 Next.js 16 的 Notion Web 应用
- [移动应用](./apps/mobile/README.md) — 基于 Expo 54 的 Notion 移动应用
- [AI 网关](./services/ai/) — 基于 Hono 的 AI API 代理服务
