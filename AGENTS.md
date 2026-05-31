# AGENTS.md

本文件是给代码 Agent 的项目入口说明。首次接手任务时先读这里，再按任务范围读取对应目录的 README、索引文档或子目录 `AGENTS.md`。

## 项目定位

My-Notion 是一个定制化个人版 Notion，核心目标是把文档编辑、AI 知识管理、跨端应用、CLI/Skills/MCP Agent 生态整合在同一个 pnpm monorepo 中。

主要能力：

- Web 端：Next.js + Convex + Clerk + BlockNote，提供文档编辑、AI 侧边栏、ReAct Agent、RAG、编辑器 AI、CLI Token 管理。
- Mobile 端：Expo + React Native，提供移动文档工作区、AI Chat、跨端共享状态和服务端代理。
- Agent 生态：通过默认 CLI Token、Convex HTTP Actions、My-Notion CLI、Skills、MCP STDIO server，让外部 Agent 安全创建、读取、搜索和更新文档。
- AI 能力：DashScope/OpenAI Compatible API、LangChain、Qdrant、DashScope Embedding、工具调用、联网搜索、网页抽取和 Memory MVP。

## 架构总览

```text
用户 / Agent
  ├─ Web UI: apps/web
  ├─ Mobile UI: apps/mobile
  ├─ CLI: packages/my-notion-cli
  └─ Skills / MCP: packages/my-notion-skills

共享包
  ├─ packages/ai        # RAG、Embedding、Agent、AI 配置
  ├─ packages/business  # Zustand、i18n、共享类型和工具
  └─ packages/convex    # Convex schema、文档、Chat、CLI Token 逻辑

后端与服务
  ├─ Convex             # 实时数据库、HTTP Actions、auth identity
  ├─ Clerk              # 登录认证
  ├─ Qdrant             # 向量数据库
  ├─ DashScope          # LLM、Embedding、工具调用
  └─ EdgeStore          # 文件/图片存储
```

## 目录导航

优先阅读对应目录的索引文档，不要一次性加载全仓库。

- `README.md`：项目总览、快速开始、技术架构、CLI/MCP Quick Start、当前状态。
- `apps/web/README.md`：Web 应用能力、技术栈、环境变量、目录结构、Web 验证命令。
- `apps/web/AGENTS.md`：Web Convex 开发规则；修改 `apps/web/convex` 前必须阅读 `apps/web/convex/_generated/ai/guidelines.md`。
- `apps/mobile/README.md`：移动端能力、Expo 架构、环境变量、目录结构。
- `apps/mobile/AGENTS.md`：Mobile Convex 开发规则；修改 `apps/mobile/convex` 前必须阅读 `apps/mobile/convex/_generated/ai/guidelines.md`。
- `packages/my-notion-cli/README.md`：CLI 命令、默认 API URL、MCP server、CLI 验证入口。
- `packages/my-notion-skills/README.md`：Agent Skills 列表、同步规则、安全约束。
- `milestones/README.md`：阶段性里程碑索引，适合快速理解已完成能力和下一步路线。
- `docs/ai-docs/README.md`：外部 AI/DashScope 能力文档索引，开发 Agent、工具调用、流式输出前按需阅读。
- `docs/my-notion-cli-release-checklist.md`：CLI/MCP 发布前检查清单。
- `progress/`：按时间记录的过程日志；需要追溯历史决策时再查看。
- `my-notion-go/`：早期 Go/Vite 版本与探索性工程，不是当前主线，除非任务明确提到该目录。

## 工作规则

- 默认在仓库根目录执行命令，使用 `pnpm` monorepo filter 精准验证。
- 修改重要阶段性能力后，在 `progress/` 下新增 Markdown 记录。
- 修改 AI 参考文档时，同时更新 `docs/ai-docs/README.md` 索引。
- 修改 Skills 源文件后运行 `pnpm sync:skills` 和 `pnpm sync:skills:check`。
- 不要把完整 `mnt_` CLI Token、Clerk secret、LLM key、EdgeStore key 写入代码、日志、文档或聊天输出。
- CLI Token 当前是单个默认 Token 模型；重置后旧 token 失效，只保留最新 token。
- Agent 写入文档、记忆等持久化内容必须遵循 `Dry-run -> Preview -> User Confirmation -> Commit` 安全链路。
- MCP 写工具默认 `dryRun: true`，只有用户明确批准后才允许真实写入。
- 连接 Convex Machine API 时使用 `.site` URL；Convex client/runtime 使用 `.cloud` URL。
- 本地 RAG/Agent 调试通常需要先启动 Qdrant：`docker compose -f my-notion-go/docker-compose.yml up -d qdrant`。

## 常用验证

按改动范围选择最小必要验证：

```bash
# Web
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke

# CLI / MCP
pnpm --filter @notion/my-notion-cli test
pnpm --filter @notion/my-notion-cli typecheck
pnpm --filter @notion/my-notion-cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp

# Skills
pnpm sync:skills
pnpm sync:skills:check

# 全局
pnpm test
pnpm exec playwright test
```

## 当前主线

截至当前文档状态，CLI/MCP/Skills 主链路已可用，Web Agent 已具备 ReAct Loop、RAG、Memory MVP、文档读写 dry-run、确认式写入和统一 tool fallback。下一阶段重点是：

- Plan 模式最小闭环：计划生成、用户确认、步骤执行、状态展示。
- Spec 模式：复杂写入前生成结构化规格。
- Web Agent MCP adapter：让 Web Agent 安全调用受控 MCP 工具。
- 流式重试、Tool 结果契约、Trace/Replay、Storybook、Memory/RAG 真实评估后续补齐。

