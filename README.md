# My-Notion

定制化的个人版 Notion，内置 AI 能力的全栈知识管理工具。

## ✨ 项目特色

- 🧠 **AI 深度集成** — RAG 知识库问答、深度思考可视化、工具调用系统与编辑器紧密结合，选中文字即可翻译、润色、提问
- 🏗️ **跨端共享架构** — AI 逻辑 (`@notion/ai`)、业务状态 (`@notion/business`)、数据层 (`@notion/convex`) 抽离为共享包，Web 和 Mobile 零重复代码
- ⚡ **紧跟最新技术栈** — Next.js 16 + React 19 + Expo 54 + TypeScript 5.9，同时通过完整 CI/CD 和监控体系保障稳定性
- 🔒 **安全代理设计** — Mobile 端 AI 调用通过 Hono 网关代理、文件上传通过 Web API 转发，客户端零密钥暴露
- 📊 **完整工程化** — GitHub Actions CI/CD（Build / Lint / TypeCheck / Unit Test / E2E）、Vitest 单测、Sentry 监控、Bundle 优化
- 🌐 **双端国际化** — next-intl (Web) + i18next (Mobile)，中/英/繁体三语支持

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

## 🗺️ Roadmap

### 🎯 近期 — AI 原生编辑器

- **选中即 AI** — BlockNote 中选中文字，右键即可翻译、润色、扩写、缩写、提问
- **自定义 BlockNote Tool** — 扩展编辑器工具栏，集成 AI 驱动的文档操作（智能续写、风格转换、语法修正）
- **Inline AI Assist** — 行内 AI 建议，类似 Copilot 的补全体验

### 🚀 中期 — RAG 增强 & Mobile 上线

- **分层检索** — 粗筛 + 精排两阶段，提升召回率和准确率
- **混合检索** — 向量检索 + 关键词检索融合
- **多格式文档** — PDF、Markdown、Word 直接入库
- **检索溯源** — 展示 RAG 引用的文档片段，支持跳转原文
- **Mobile 上架** — iOS App Store / Android Google Play 发布

### 🔮 远期 — CLI & Agent 生态

- **My-Notion CLI** — 命令行工具，支持 `notion create`、`notion search`、`notion ask`
- **Agent 可调用** — 开放 CLI 接口，让 AI Agent 读写文档、查询知识库
- **MCP 协议** — 接入 Model Context Protocol，成为 AI Agent 的标准工具

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
