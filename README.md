# My-Notion

定制化的个人版 Notion，内置 Agent 驱动的 AI 知识管理、跨端文档编辑、CLI/Skills/MCP Agent 生态能力。

**线上体验：** [https://notion-j9zj.vercel.app/](https://notion-j9zj.vercel.app/)

## 项目入口

- [Web 应用说明](./apps/web/README.md) — Next.js Web 端、线上体验、截图、AI Agent 与文档编辑能力。
- [Mobile 应用说明](./apps/mobile/README.md) — Expo 移动端、跨端共享架构、移动端运行与构建。
- [My-Notion CLI](./packages/my-notion-cli/) — 供终端和外部 Agent 调用的文档管理 CLI。
- [My-Notion Skills](./packages/my-notion-skills/) — 供 Agent 学习如何调用 CLI/MCP 的技能说明。

## 核心技术优势

- **Agent ReAct Loop**：AI 侧边栏不再依赖硬编码关键词路由，由 LLM 自主判断是否调用 `knowledge_search`、`web_search`、`document_read` 等工具，支持多轮推理和多工具并行。
- **RAG 知识库**：基于 Qdrant 向量检索与 DashScope Embedding，支持知识库检索、引用来源展示、文档标题跳转和 Qdrant 离线降级。
- **编辑器 AI**：Web 端集成 BlockNote 与 `@blocknote/xl-ai`，支持选中文字润色、翻译、摘要、扩写、续写等原生编辑器 AI 操作。
- **CLI / Skills / MCP 生态**：通过 PAT + Convex HTTP Actions 暴露机器 API，外部 Agent 可用 CLI 或 MCP STDIO server 创建、读取、搜索、更新 My-Notion 文档。
- **跨端共享架构**：`@notion/ai`、`@notion/business`、`@notion/convex` 抽离为共享包，Web 与 Mobile 复用 AI、业务状态、Convex 数据逻辑。
- **安全代理设计**：移动端 AI 调用和文件上传均通过服务端代理，避免在客户端暴露 LLM、EdgeStore 等敏感密钥。
- **工程化闭环**：覆盖 TypeScript、ESLint、Vitest、Playwright、CLI E2E、MCP STDIO E2E、Sentry 与 GitHub Actions。

## 项目结构

```text
My-Notion/
├── apps/
│   ├── web/                    # Next.js 16 Web 应用
│   └── mobile/                 # Expo 54 移动应用
├── packages/
│   ├── ai/                     # AI、RAG、Embeddings、Agent 服务端逻辑
│   ├── business/               # Zustand Stores、i18n、类型、工具函数
│   ├── convex/                 # Convex Schema、Documents、Chat、CLI Token 逻辑
│   ├── my-notion-cli/          # CLI：auth/docs/tokens/mcp 命令
│   └── my-notion-skills/       # Agent Skills 源文件
├── services/ai/                # AI 网关服务
├── scripts/
│   ├── e2e-my-notion-cli.mjs   # CLI + Convex HTTP Actions E2E
│   ├── e2e-my-notion-mcp.mjs   # MCP STDIO E2E
│   └── sync-my-notion-skills.mjs
├── tests/                      # Playwright E2E
└── .trae/skills/               # Agent 可发现的本地 Skills
```

## 技术架构

```text
用户 / Agent
  ├─ Web UI：Next.js + React + BlockNote
  ├─ Mobile UI：Expo + React Native + Tamagui
  ├─ CLI：my-notion auth/docs/tokens
  └─ MCP：my-notion mcp serve --transport stdio

共享能力层
  ├─ @notion/ai：RAG、Agent、Editor AI 服务端逻辑
  ├─ @notion/business：跨端状态、i18n、业务类型
  └─ @notion/convex：Schema、文档、Chat、PAT 校验

后端与外部服务
  ├─ Convex：实时数据库 + HTTP Actions
  ├─ Clerk：认证
  ├─ Qdrant：向量数据库
  ├─ DashScope/OpenAI Compatible API：LLM 与 Embedding
  └─ EdgeStore：文件存储
```

## 常用命令

```bash
# 安装依赖
pnpm i

# Web / Mobile
pnpm start:web
pnpm start:mobile

# 构建
pnpm build:web
pnpm build:mobile

# 测试与验证
pnpm test
pnpm exec playwright test
pnpm e2e:cli
pnpm e2e:mcp
pnpm sync:skills
```

## 当前状态

- Web 端已具备文档编辑、AI 侧边栏、RAG 检索、联网搜索、编辑器 AI、PAT 管理与 CLI/MCP 机器访问能力。
- Mobile 端已具备文档树、文档编辑、AI Chat、跨端业务状态、Convex 数据访问与服务端代理能力。
- Agent 生态已完成 CLI、Skills、MCP STDIO MVP，后续重点是文档清理 API、限流审计、远程 MCP/OAuth 与更强 RAG 检索。
