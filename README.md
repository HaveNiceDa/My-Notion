# My-Notion

定制化的个人版 Notion，内置 Agent 驱动的 AI 全栈知识管理工具。

## ✨ 项目特色

- 🤖 **Agent 架构** — ReAct 循环引擎驱动，LLM 自主决策工具调用（知识库检索 / 联网搜索 / 文档阅读），多轮推理 + 工具执行 + 结果反馈，告别硬编码路由
- 🧠 **RAG 知识库** — 向量检索 + LLM 深度思考，工具化设计让 Agent 按需调用，检索结果溯源展示，文档标题可点击跳转
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
│   │   └── src/lib/agent/      # Agent 核心引擎
│   │       ├── react-loop.ts   # ReAct 循环：LLM 自主决策 → 工具执行 → 结果反馈
│   │       ├── tools/          # 工具定义（knowledge_search / web_search / document_read）
│   │       ├── stream.ts       # NDJSON 流式事件协议
│   │       └── context-compression.ts  # 长对话自动压缩
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

### Agent 架构

```
用户消息 → AI Sidebar
  → /api/agent/stream (Next.js API Route)
    → ReAct Loop Engine
      ├─ LLM 自主决策（看到可用 tools 列表，判断是否需要调用）
      ├─ 无 tool_calls → 直接输出文本，循环结束
      └─ 有 tool_calls → 并行执行所有 tools → 结果反馈 LLM → 继续推理
         ├─ knowledge_search  → Qdrant 向量检索 + DashScope Embedding
         ├─ web_search        → DashScope 联网搜索（流式）
         └─ document_read     → 读取当前文档内容
    → NDJSON 流式事件（text-delta / tool-call-start / tool-call-result / finish）
    → 前端实时渲染（Markdown + 工具卡片 + 深度思考折叠）
```

**核心设计原则**：
- **LLM 自主决策** — 不硬编码关键词路由，LLM 通过 tool description 自主判断何时调用哪个工具
- **ReAct 循环** — 推理（Reasoning）+ 行动（Acting）交替，最多 5 轮迭代，支持多工具并行
- **工具标准化** — 每个 tool 自带 OpenAI function schema，新增 tool 只需实现 `AgentTool` 接口
- **长对话压缩** — token 超阈值时自动摘要旧消息 + 保留最近 N 轮，防止上下文溢出

### 跨端共享层

| 共享包 | 职责 | 被依赖方 |
|--------|------|----------|
| `@notion/ai` | RAG 检索、Embeddings、流式 Chat、工具调用 | Web + Mobile + AI Service |
| `@notion/business` | Zustand Stores（AI 模型/知识库/深度思考）、i18n、类型校验 | Web + Mobile |
| `@notion/convex` | Convex Schema、Documents/Chat 业务逻辑（超集版） | Web + Mobile |

### 工程化体系

```
代码提交 → GitHub Actions
  ├─ Build (Web + AI Service)
  ├─ Lint + TypeCheck + Unit Tests (Vitest, 20+ 用例)
  └─ E2E Tests (Playwright)
→ Vercel 自动部署
→ Sentry 线上监控
```

## 🗺️ Roadmap

### ✅ 已完成

- **Agent ReAct 循环** — 替换硬编码关键词路由，LLM 自主决策工具调用，支持多轮推理 + 多工具并行
- **AI 侧边栏** — 从独立页面重构为右侧可折叠面板，工具调用结果持久化展示，文档标题可点击跳转
- **工具卡片** — knowledge_search 展示引用文档列表，web_search 展示搜索关键词，document_read 展示文档标题
- **长对话压缩** — token 超阈值时 LLM 摘要旧消息，保留最近 N 轮，摘要失败自动回退截断
- **Web 编辑器 AI** — 基于 `@blocknote/xl-ai`，选中文字可翻译（中/英）、润色、扩写、缩写；光标处可续写、生成大纲、总结内容
- **Mobile SSE 平台分流** — Web 端 `ReadableStream` 流式读取，Native 端 `response.text()` 兼容方案
- **Markdown 渲染** — react-markdown + remark-gfm + rehype-highlight，代码高亮 + GFM 表格
- **错误边界** — AIChatErrorBoundary 防止面板白屏，支持重试

### 🎯 近期 — Agent 能力增强

- **Spec 模式** — LLM 先输出结构化规格说明，用户确认后再执行
- **Plan 模式** — LLM 先输出执行计划，逐步执行并展示进度
- **MCP 接入** — 通过 DashScope Responses API 接入百炼托管 MCP 服务，支持跨文档读取
- **对话上下文压缩优化** — 用 tiktoken 精确计数替代当前的 chars/2 粗略估算

### 🚀 中期 — RAG 增强

- **分层检索** — 粗筛 + 精排两阶段，提升召回率和准确率
- **混合检索** — 向量检索 + BM25 关键词检索融合
- **多格式文档** — PDF、Markdown、Word 直接入库
- **检索溯源** — 展示 RAG 引用的文档片段，支持跳转原文

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
| **Agent 引擎** | ReAct Loop / OpenAI Function Calling / NDJSON Streaming |
| **AI/LLM** | LangChain / OpenAI SDK / DeepSeek-v4-pro / Qdrant |
| **后端/数据库** | Convex (实时数据库) / EdgeStore (文件存储) |
| **AI 网关** | Vercel Edge Function |
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
- [AI 网关](./services/ai/) — Vercel Edge Function AI API 代理服务
