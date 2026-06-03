# 我做了一个 AI Native 的个人版 Notion：文档、Agent、RAG、移动端、CLI/MCP 一套打通

如果你也长期使用 Notion、飞书文档、Obsidian 或各种 AI Chat 工具，大概率会遇到一个共同的问题：

> 文档在一个地方，AI 在另一个地方；知识库能搜，但不一定能行动；Agent 能写，但未必安全；移动端能看，但和 Web 端能力又经常割裂。

`My-Notion` 想解决的正是这类问题。

它不是简单复刻一个 Notion 编辑器，而是把 **文档编辑、AI Agent、RAG 知识检索、长期记忆、移动端工作区、CLI、Skills、MCP** 放进同一个 monorepo，试图做一个真正面向人类用户和 AI Agent 的个人知识管理系统。

线上体验地址：

- <https://notion-j9zj.vercel.app/>

项目关键词：

- `Next.js 16`
- `React 19`
- `Convex`
- `Clerk`
- `BlockNote`
- `DashScope / OpenAI Compatible API`
- `LangChain`
- `Qdrant`
- `Expo`
- `CLI`
- `MCP`
- `Agent Skills`

---

## 一、项目是什么？

`My-Notion` 是一个定制化个人版 Notion。

但它的目标并不只是“做一个在线文档应用”，而是构建一个 **AI Native 的知识工作台**：

- 对普通用户：提供类似 Notion 的文档树、富文本编辑、收藏、归档、回收站、公开预览、移动端访问等基础体验。
- 对 AI 用户：提供侧边栏 AI Chat、编辑器选区 AI、RAG 检索、联网搜索、网页抽取、长期记忆、Plan 模式和确认式文档写入。
- 对开发者和 Agent：提供 `@mynotion/cli`、MCP STDIO server、Agent Skills，让外部 Agent 可以安全地创建、读取、搜索和更新 My-Notion 文档。

你可以把它理解成：

> 一个文档系统 + 一个个人知识库 + 一个可执行的 AI Agent + 一套 Agent 访问协议。

---

## 二、为什么值得看？

市面上有很多“Notion Clone”，也有很多“AI Chat + RAG Demo”。但 `My-Notion` 更有参考价值的地方在于：它不是单点 Demo，而是把多个真实产品化问题放到一起处理。

它覆盖了这些工程问题：

- 如何在 Web 文档编辑器里接入 AI 选区能力？
- 如何让 AI Chat 从“问答机器人”升级成 ReAct Agent？
- 如何让 Agent 自主选择工具，而不是靠前端写死关键词路由？
- 如何让 RAG 支持语义、关键词、元数据混合召回？
- 如何在写文档、写记忆时避免 Agent 直接落库？
- 如何让外部 Agent 通过 CLI/MCP 操作文档？
- 如何用 Markdown 作为 Agent 与文档系统之间的稳定契约？
- 如何同时维护 Web、Mobile、CLI、Skills、MCP 的工程边界？

这些问题比单纯搭一个聊天框更接近真实项目。

---

## 三、核心功能概览

### 1. Web 文档工作区

Web 端基于 `Next.js 16 + React 19`，编辑器使用 `BlockNote`，数据层使用 `Convex`，认证使用 `Clerk`。

目前已经支持：

- Notion 风格文档树
- 富文本编辑
- 文档标题、图标、封面
- 收藏、归档、回收站
- 最近文档
- 全局搜索
- 公开预览
- 设置页
- CLI 授权页
- Token 管理 UI
- AI 右侧边栏
- 编辑器选区 AI

它不是只做了一个 editor，而是围绕文档生命周期做了比较完整的工作区体验。

### 2. 编辑器 AI

编辑器 AI 基于 `@blocknote/xl-ai`，直接嵌入文档编辑流程。

常见能力包括：

- 选中文本后翻译
- 选中文本后润色
- 拼写修复
- 内容摘要
- 续写
- 多语言处理

这类能力的价值在于，它不需要用户离开编辑器，也不需要复制文本到另一个 Chat 窗口。AI 直接成为编辑器能力的一部分。

### 3. AI Chat 侧边栏

项目早期将 AI Chat 从独立页面重构成了右侧可拖拽侧边栏，最终形成了更接近 Notion AI / 飞书智能伙伴的交互形态。

侧边栏不仅能聊天，还能读取当前文档上下文，并展示工具调用过程。

它支持：

- Markdown 渲染
- Agent 思考过程展示
- Tool Call 卡片
- Tool Result 折叠
- 流式输出
- 深度思考展示
- 错误边界
- 自动滚动优化

这部分已经不是“一个 textarea + 一个接口”的简单 Chat UI，而是在做可观察、可控、可恢复的 Agent 交互体验。

---

## 四、最值得展开的 AI 能力

`My-Notion` 里最值得关注的是 AI Agent 主线。

它现在已经从普通 RAG 问答，演进到了 **ReAct Agent + Tool Registry + RAG + Memory + Plan Mode** 的结构。

### 1. ReAct Loop：让模型自己决定调用什么工具

AI Chat 后端不再靠硬编码关键词判断“用户是不是要搜索知识库”。

项目实现了标准 ReAct Loop：

```text
用户问题
  ↓
LLM 思考是否需要工具
  ↓
调用工具
  ↓
工具结果写回上下文
  ↓
LLM 继续推理
  ↓
输出最终答案
```

当前循环最多执行 5 轮，避免无限调用工具。

这带来一个很重要的变化：

- 用户问项目历史，模型可以调用 `knowledge_search`。
- 用户让总结当前文档，模型可以调用 `document_read`。
- 用户贴一个网页，模型可以调用 `web_extract`。
- 用户要查最新信息，模型可以调用 `web_search`。
- 用户要创建文档，模型可以调用 `document_write`，但只生成预览。
- 用户让记住偏好，模型可以调用 `memory_write`，但需要确认。

Agent 从“有 RAG 的聊天机器人”变成了“能读、能搜、能规划、能生成写入预览的助手”。

### 2. Tool Registry：统一工具体系

当前 Web Agent 内置工具包括：

| Tool | 能力 |
| --- | --- |
| `knowledge_search` | 搜索个人知识库和笔记 |
| `document_read` | 读取当前正在查看的文档 |
| `document_search` | 按标题、路径、最近编辑时间搜索文档元数据 |
| `document_write` | 创建新文档的 dry-run 预览 |
| `document_update` | 更新文档的 dry-run 预览 |
| `web_search` | 联网搜索实时信息 |
| `web_extract` | 抽取指定网页正文 |
| `memory_read` | 读取长期记忆 |
| `memory_write` | 写入长期记忆预览 |
| `task_plan` | 生成多步骤任务计划 |

每个工具都有自己的 schema、description 和 execute 函数，模型通过 OpenAI-compatible function calling 自动判断是否调用。

这个设计有几个好处：

- 工具描述可被模型理解，扩展新工具比较自然。
- 工具执行边界统一，方便做 fallback、trace、缓存和权限控制。
- 读工具与写工具可以采用不同安全策略。
- 后续接入 MCP adapter 时，可以把外部 MCP 工具纳入同一个 Agent 生态。

### 3. RAG：不是只做向量搜索

项目里的知识库检索不是单纯 `embedding -> vector search -> topK`。

当前检索策略分为：

- `fast`：只走语义向量召回，适合低延迟场景。
- `balanced`：默认策略，语义召回、关键词召回、元数据召回三路并发。
- `deep`：复杂问题会先做 query rewrite，再对多个 query variant 分别召回。

默认的 `balanced` 会并发执行：

```text
semantic recall
keyword recall
metadata recall
```

然后使用 RRF 做融合排序，再进行 context packing 和 citation quality 评估。

这比普通向量搜索更稳，因为真实知识库里经常出现这些问题：

- 用户记得标题里的一个词，但正文语义不明显。
- 文档最近编辑过，但 query 不一定能精确命中。
- 向量相似度高的 chunk 不一定是最有用的上下文。
- 多文档归纳时需要更高召回，而不是只看 top3。

所以这个 RAG 实现更偏真实产品，而不是教程级 Demo。

### 4. Memory：让 Agent 有长期偏好

项目已经实现了 Memory MVP，包含：

- 用户偏好
- 项目事实
- 阶段性对话结论
- Memory Review UI
- 语义检索
- token/recency fallback
- 写入、编辑、停用后的缓存清理
- 与 Qdrant 同步

Memory 写入不是偷偷发生的。

写入类工具遵循：

```text
dry-run
  ↓
预览
  ↓
用户确认
  ↓
commit
```

这点非常关键。

很多 AI 应用做 Memory 时容易走向“模型觉得应该记就自动记”，最后记忆污染很严重。`My-Notion` 的策略更谨慎：Agent 可以提议记忆，但最终是否写入由用户确认。

### 5. Plan Mode：复杂任务先规划再执行

项目已经完成 Plan 模式最小闭环。

Plan 模式下，后端计划生成阶段只允许调用 `task_plan` 工具。也就是说，Agent 先把复杂任务拆成步骤，而不是一上来就执行。

流程类似：

```text
用户提出复杂任务
  ↓
Agent 生成计划
  ↓
前端展示计划
  ↓
用户确认
  ↓
Agent 按计划进入执行
```

这个设计对长任务非常重要，因为它把“可控性”前置了。

比如用户说：

> 帮我整理这个项目的技术文章，并生成一篇推荐稿。

Agent 应该先规划：

- 读取项目入口文档
- 提炼架构和亮点
- 重点梳理 AI 能力
- 生成文章
- 写入目标目录

而不是直接改文件。

---

## 五、最重要的安全设计：确认式写入

如果说 `My-Notion` 的 AI 能力有什么特别值得借鉴的设计，我会首推 **确认式写入**。

在这个项目里，写类操作不会默认直接落库：

- `document_write` 默认生成创建文档预览。
- `document_update` 默认生成更新文档预览。
- `memory_write` 默认生成记忆写入预览。
- MCP 写工具默认 `dryRun: true`。

真实写入必须经过用户确认。

这个策略可以概括为：

```text
Agent 负责生成方案
用户负责确认边界
系统负责安全提交
```

它避免了几个高风险问题：

- Agent 误改重要文档。
- Agent 覆盖全文而不是追加。
- Agent 生成错误结构直接写入 BlockNote JSON。
- Agent 在用户不知情时写入长期记忆。
- 外部 MCP Client 绕过产品侧确认链路。

在 AI 应用进入“能行动”的阶段后，这类安全链路会越来越重要。

---

## 六、Markdown 契约：Agent 不直接碰 BlockNote JSON

另一个很实用的工程决策是：

> Agent 默认只读写 Markdown，系统负责 Markdown 与 BlockNote blocks 的双向转换。

也就是说：

- 文档内部仍然可以用 BlockNote JSON 存储。
- Agent 读取时拿到的是 `contentMarkdown`。
- Agent 创建或更新时提交的也是 Markdown。
- 服务端负责 Markdown `<->` BlockNote blocks 转换。

这样做的好处很明显：

- Markdown 对 LLM 更友好。
- 外部 Agent 不需要理解 BlockNote 内部结构。
- CLI/MCP/Skills 都能共享同一套内容契约。
- 文档迁移、导入、导出更自然。
- 降低写入坏结构的概率。

很多文档类 AI 项目会让模型直接生成编辑器 JSON，这在 Demo 阶段看似方便，但长期很难维护。`My-Notion` 选择 Markdown 作为中间层，工程上更稳。

---

## 七、项目架构

整体采用 pnpm monorepo：

```text
My-Notion/
├── apps/
│   ├── web/                    # Next.js Web 应用
│   └── mobile/                 # Expo 移动应用
├── packages/
│   ├── ai/                     # AI、RAG、Embedding、Agent 服务端逻辑
│   ├── business/               # Zustand、i18n、共享类型和工具函数
│   ├── convex/                 # Convex schema、文档、Chat、CLI Token 逻辑
│   ├── my-notion-cli/          # @mynotion/cli 源码
│   └── my-notion-skills/       # Agent Skills 源文件
├── docs/                       # 当前方案、发布检查、AI 外部文档索引
├── milestones/                 # 稳定阶段结论
├── progress/                   # 阶段进展记录
└── scripts/                    # E2E、skills sync、发布辅助脚本
```

运行时架构可以简化成：

```text
用户 / Agent
  ├─ Web UI: apps/web
  ├─ Mobile UI: apps/mobile
  ├─ CLI: @mynotion/cli
  └─ Skills / MCP: Agent Skills + my-notion mcp serve

共享包
  ├─ packages/ai
  ├─ packages/business
  └─ packages/convex

后端与服务
  ├─ Convex
  ├─ Clerk
  ├─ Qdrant
  ├─ DashScope / OpenAI Compatible API
  └─ EdgeStore
```

### Web 端

Web 端负责主要产品体验：

- 文档工作区
- BlockNote 编辑器
- AI Chat 侧边栏
- Agent API Routes
- 编辑器 AI API
- CLI 授权页
- Convex HTTP Actions
- Token 管理 UI

技术栈：

| 层级 | 技术 |
| --- | --- |
| Web 框架 | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| 编辑器 | BlockNote, `@blocknote/xl-ai` |
| 数据与认证 | Convex, Clerk |
| AI | DashScope/OpenAI Compatible API, LangChain, Qdrant, SerpAPI |
| 状态与国际化 | Zustand, next-intl |
| 测试与监控 | Vitest, Playwright, Sentry |

### Mobile 端

移动端基于 `Expo 54 + React Native 0.81`，目标是在手机上提供轻量文档管理和 AI 知识助手体验。

已支持：

- 移动文档树
- 最近文档
- 回收站
- 收藏
- 归档
- 搜索
- 文档编辑
- AI Chat
- 会话管理
- 模型选择
- 深度思考展示
- 服务端安全代理

技术栈：

| 层级 | 技术 |
| --- | --- |
| 移动框架 | Expo 54, React Native 0.81 |
| 路由 | Expo Router 6 |
| UI | Tamagui 2, Reanimated, Gesture Handler |
| 编辑器 | TenTap / TipTap |
| 数据与认证 | Convex, Clerk Expo |
| AI | 服务端代理 + `@notion/ai` 共享逻辑 |
| 构建 | EAS Build |

### CLI / MCP / Skills

这是项目很有意思的一部分。

`@mynotion/cli` 已发布到 npm，支持：

- 浏览器 Device Flow 登录
- 文档创建
- 文档读取
- 文档搜索
- 文档列表
- 文档更新
- 文档归档
- Markdown 导入
- Markdown 导出
- MCP STDIO server
- Agent Skills 随包分发

安装方式：

```bash
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g
my-notion config init
my-notion auth login
```

MCP 启动：

```bash
my-notion mcp serve --transport stdio
```

当前 MCP 暴露的工具包括：

| Tool | 能力 | 默认安全策略 |
| --- | --- | --- |
| `my_notion_docs_search` | 搜索文档 | 只读 |
| `my_notion_docs_fetch` | 读取文档 | 只读 |
| `my_notion_docs_create` | 创建文档 | `dryRun: true` |
| `my_notion_docs_update` | 更新文档 | `dryRun: true` |

它不是只给人类用户用的 CLI，而是明确面向 Agent 设计：

- 默认推荐 JSON 输出。
- 错误信息稳定。
- 文档内容通过 Markdown 交换。
- 登录使用浏览器 Device Flow，不要求用户粘贴完整 Token。
- prod/local 配置物理隔离。
- MCP 写工具默认 dry-run。

---

## 八、快速启动

### 1. 克隆并安装依赖

```bash
pnpm i
```

### 2. 启动 Web

```bash
pnpm start:web
```

或者进入 Web 包：

```bash
cd apps/web
pnpm start
```

### 3. 启动本地 Qdrant

如果要调试 RAG / Agent，通常需要先启动 Qdrant：

```bash
docker compose -f my-notion-go/docker-compose.yml up -d qdrant
```

### 4. 启动 Mobile

```bash
pnpm start:mobile
```

或者：

```bash
cd apps/mobile
pnpm dev
```

本地 AI 服务调试：

```bash
cd apps/mobile
pnpm dev:local
```

### 5. 安装 CLI

```bash
npm install -g @mynotion/cli@beta
npx skills add @mynotion/cli -y -g
my-notion config init
my-notion auth login
```

创建文档：

```bash
my-notion docs create \
  --title "项目周报" \
  --content-file ./weekly-report.md \
  --format json
```

搜索文档：

```bash
my-notion docs search \
  --query "项目周报" \
  --limit 10 \
  --format json
```

读取文档 Markdown：

```bash
my-notion docs fetch \
  --id <documentId> \
  --format markdown
```

---

## 九、环境变量

Web 端主要环境变量放在 `apps/web/.env.local`：

```env
CONVEX_DEPLOYMENT=your-convex-deployment
NEXT_PUBLIC_CONVEX_URL=your-convex-url
NEXT_PUBLIC_CONVEX_SITE_URL=your-convex-site-url

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
CLERK_JWT_ISSUER_DOMAIN=your-clerk-jwt-issuer-domain

EDGE_STORE_ACCESS_KEY=your-edgestore-access-key
EDGE_STORE_SECRET_KEY=your-edgestore-secret-key

NEXT_PUBLIC_QDRANT_URL=your-qdrant-url
NEXT_PUBLIC_QDRANT_API_KEY=your-qdrant-api-key

LLM_API_KEY=your-llm-api-key
SERPAPI_API_KEY=your-serpapi-api-key
```

Mobile 端主要环境变量放在 `apps/mobile/.env`：

```env
CONVEX_DEPLOYMENT=your-convex-deployment
EXPO_PUBLIC_CONVEX_URL=your-convex-url
EXPO_PUBLIC_CONVEX_SITE_URL=your-convex-site-url

EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

注意：

- Convex Machine API 使用 `.site` URL。
- Convex client/runtime 使用 `.cloud` URL。
- 真机调试本地 AI 时，`localhost` 需要替换成局域网 IP。
- Qdrant 离线时，RAG 能力会降级，但基础文档编辑不应受影响。

---

## 十、验证命令

项目验证链路比较完整。

Web：

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke
```

CLI / MCP：

```bash
pnpm --filter @mynotion/cli test
pnpm --filter @mynotion/cli typecheck
pnpm --filter @mynotion/cli build
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
pnpm e2e:mcp:client
```

Skills：

```bash
pnpm sync:skills
pnpm sync:skills:package
pnpm sync:skills:check
```

全局：

```bash
pnpm test
pnpm exec playwright test
```

目前 `@mynotion/cli@0.1.0-beta.1` 已发布到 npm，并通过了 CLI 单测、typecheck、build、CLI E2E、MCP E2E、真实 SDK Client E2E、Skills 同步校验和 npm pack 验证。

---

## 十一、一些工程设计取舍

### 1. 为什么用 Convex？

Convex 很适合这类实时文档和 AI 工作区应用。

它承担了：

- 文档数据
- Chat 数据
- CLI Token
- HTTP Actions
- 机器 API
- 实时更新

对于一个需要 Web、Mobile、CLI 同时访问的项目来说，Convex 可以减少很多传统后端样板代码。

### 2. 为什么用 Clerk？

认证系统通常不值得从零造。

Clerk 负责 Web 和 Mobile 登录，CLI 则通过 Device Flow 授权，避免用户在聊天窗口里粘贴完整 `mnt_` Token。

这个设计对 Agent 场景很重要：Agent 只需要把授权链接发给用户，用户在浏览器确认即可。

### 3. 为什么用 Qdrant？

RAG 需要向量检索能力，Qdrant 是比较成熟的向量数据库。

项目里不仅用它做知识库检索，也和 Memory 语义检索相关。

本地调试时可以通过 Docker Compose 启动 Qdrant，线上则可以接远程服务。

### 4. 为什么 CLI 默认连接线上？

`my-notion` CLI 默认连接线上 `prod`，本地调试必须显式传 `--local`。

这样可以避免本地开发、线上使用、Agent 调用之间互相污染登录态。

配置文件也做了物理隔离：

- 线上：`config.json`
- 本地：`config.local.json`

这是一个很小但很实用的工程细节。

---

## 十二、适合谁参考？

这个项目适合这些人重点关注：

- 想做 Notion Clone，但不想停留在编辑器 Demo 的同学。
- 想做 AI 知识库、RAG、个人助手的同学。
- 想了解 ReAct Agent 工程落地的同学。
- 想学习 Tool Calling、Tool Registry、Agent Trace 的同学。
- 想做 AI 文档写入，但担心安全问题的同学。
- 想把 Web 产品能力暴露给 CLI / MCP / Agent 的同学。
- 想参考 Next.js + Convex + Clerk + Expo monorepo 架构的同学。

如果你只想看一个简单的 RAG Demo，这个项目可能偏重。

但如果你关心的是“AI 应用如何从 Demo 走向产品工程”，它会更有参考价值。

---

## 十三、当前路线

当前已完成的主要里程碑包括：

- AI Chat 侧边栏重构
- Agent Stream + Knowledge Search Tool
- Agent Auto Tool Routing
- Document Read Tool
- ReAct Agent Loop
- AI Chat UX 与 Markdown 渲染打磨
- CLI / Skills / MCP Agent 写文档链路
- Web Agent 主线、Memory MVP、Hybrid Retrieval、确认式写入
- Agent 单测、AI Smoke、最小 retrieval eval
- Plan 模式最小闭环
- `@mynotion/cli@0.1.0-beta.1` 发布

下一阶段重点：

- Web Agent MCP adapter
- 流式重试
- Tool 结果契约进一步统一
- Plan 状态增强
- Memory/RAG 真实质量评估
- Trace Replay
- Storybook
- Mobile AI/RAG 能力对齐

---

## 十四、总结

`My-Notion` 最吸引我的地方，不是它“像 Notion”，而是它把文档系统和 AI Agent 的边界处理得比较认真。

它没有把 AI 简化成一个聊天框，而是做了：

- 编辑器内 AI
- 侧边栏 Agent
- ReAct Loop
- Tool Registry
- RAG 混合召回
- Memory MVP
- Plan 模式
- 确认式写入
- Markdown 内容契约
- CLI / MCP / Skills
- Web / Mobile 跨端共享

如果说传统文档工具解决的是“人如何组织信息”，那 `My-Notion` 进一步探索的是：

> 当 AI Agent 也成为信息消费者和执行者时，文档系统应该如何设计？

这也是它和普通 Notion Clone 最大的不同。

对我来说，它更像是一个面向 AI 时代的个人知识工作台实验：既保留文档工具的稳定性，又让 Agent 能安全地读取、搜索、规划和写入。

如果你正在做 AI 知识库、文档协作、RAG、Agent 工具调用或 MCP 相关项目，`My-Notion` 值得拆开看看。

