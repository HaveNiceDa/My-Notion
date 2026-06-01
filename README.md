# My-Notion

定制化个人版 Notion，聚合 Web 文档编辑、移动端工作区、AI Agent、RAG/Memory、CLI/Skills/MCP Agent 生态。

**线上体验：** <https://notion-j9zj.vercel.app/>

## 项目入口

- [Web 应用说明](./apps/web/README.md)：Next.js Web 端、BlockNote 编辑器、AI Agent、CLI 授权页和机器 API。
- [Mobile 应用说明](./apps/mobile/README.md)：Expo 移动端、文档工作区、移动 AI Chat 和跨端共享架构。
- [My-Notion CLI](./packages/my-notion-cli/README.md)：已发布 npm 包 [`@mynotion/cli`](https://www.npmjs.com/package/@mynotion/cli)，提供 `my-notion` 命令和 MCP STDIO server。
- [My-Notion Skills](./packages/my-notion-skills/README.md)：供 Agent 调用 CLI/MCP 的 Skills 源文件与同步规则。
- [里程碑索引](./milestones/README.md)：稳定阶段结论和下一步路线。
- [阶段进展摘要](./progress/README.md)：压缩后的历史过程记录。
- [Docs 索引](./docs/README.md)：当前维护文档、操作手册、历史复盘和外部 AI 参考入口。
- [Web / Mobile 差距](./docs/web-mobile-gap-analysis.md)：当前双端能力差距和后续 backlog。

## 当前能力

- **Web 文档编辑**：Next.js + Convex + Clerk + BlockNote，支持文档树、编辑器 AI、公开预览、收藏、归档、回收站和设置页。
- **Web Agent**：ReAct Loop、RAG、Memory MVP、联网搜索、网页抽取、文档读写 dry-run、确认式写入和 `task_plan` 基础工具。
- **Mobile 工作区**：Expo + React Native，支持移动文档树、文档编辑、AI Chat、会话管理、模型选择、深度思考展示和安全代理。
- **CLI / Skills / MCP**：`@mynotion/cli@beta` 已发布，支持浏览器 Device Flow 登录、文档 CRUD、导入导出、MCP STDIO 和随包发布的 Agent Skills。
- **共享包**：`packages/ai`、`packages/business`、`packages/convex` 收敛 AI、业务状态、i18n、Convex schema 和文档逻辑。
- **验证链路**：覆盖 Web typecheck/build/lint、Agent 单测、AI smoke、CLI E2E、MCP E2E、Skills 漂移检查和 npm pack/publish 验证。

## 架构总览

```text
用户 / Agent
  ├─ Web UI: apps/web
  ├─ Mobile UI: apps/mobile
  ├─ CLI: @mynotion/cli / packages/my-notion-cli
  └─ Skills / MCP: packages/my-notion-skills + my-notion mcp serve

共享包
  ├─ packages/ai        # RAG、Embedding、Agent、AI 配置
  ├─ packages/business  # Zustand、i18n、共享类型和工具函数
  └─ packages/convex    # Convex schema、文档、Chat、CLI Token 逻辑

后端与服务
  ├─ Convex             # 实时数据库 + HTTP Actions / Machine API
  ├─ Clerk              # 登录认证
  ├─ Qdrant             # 向量数据库
  ├─ DashScope          # LLM、Embedding、工具调用
  └─ EdgeStore          # 文件与图片存储
```

## 目录结构

```text
My-Notion/
├── apps/
│   ├── web/                    # Next.js Web 应用
│   └── mobile/                 # Expo 移动应用
├── packages/
│   ├── ai/                     # AI、RAG、Embeddings、Agent 服务端逻辑
│   ├── business/               # Zustand Stores、i18n、类型、工具函数
│   ├── convex/                 # Convex Schema、Documents、Chat、CLI Token 逻辑
│   ├── my-notion-cli/          # @mynotion/cli 源码与 npm 包内容
│   └── my-notion-skills/       # Agent Skills 源文件
├── docs/                       # 当前方案、发布检查、AI 外部文档索引
├── milestones/                 # 稳定阶段结论
├── progress/                   # 压缩后的阶段进展记录
├── scripts/                    # E2E、skills sync、发布辅助脚本
└── .trae/skills/               # 同步后的本地 Agent Skills
```

## 快速开始

```bash
pnpm i

# Web
pnpm start:web

# Mobile
pnpm start:mobile

# 本地 RAG / Agent 调试通常需要先启动 Qdrant
docker compose -f my-notion-go/docker-compose.yml up -d qdrant
```

## CLI / MCP Quick Start

CLI 已发布到 npm beta：[`@mynotion/cli`](https://www.npmjs.com/package/@mynotion/cli)。

```bash
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g
my-notion install --check
my-notion config init
my-notion auth login
```

Agent 场景使用：

```bash
my-notion auth login --no-open
my-notion config init --check --format json
my-notion docs create --title "Agent Doc" --content-file /tmp/doc.md --format json
my-notion mcp serve --transport stdio
```

约定：Agent 必须把授权 URL 以 Markdown 可点击链接发给用户；写入已有文档优先使用 append；MCP 写工具默认保持 `dryRun: true`。

## 常用验证

```bash
# Web
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke

# CLI / MCP / Skills
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm e2e:mcp:client
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check

# 全局
pnpm test
pnpm exec playwright test
```

## 当前主线

- P0：Plan 模式最小闭环，基于 `task_plan` 完成计划生成、用户确认、步骤执行和状态展示。
- P1：Spec 模式、Web Agent MCP adapter、流式重试和 Tool 结果契约细化。
- P2：Memory/RAG 质量评估、Trace Replay、Storybook 和 Mobile AI/RAG 对齐。
- 发布：[`@mynotion/cli@0.1.0-beta.0`](https://www.npmjs.com/package/@mynotion/cli) 已发布；稳定版发布前参考 [CLI Release Checklist](./docs/my-notion-cli-release-checklist.md)。
