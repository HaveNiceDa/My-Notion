# My-Notion Mobile

基于 Expo 54 + React Native 0.81 的 My-Notion 移动端应用，与 Web 端共享 AI、业务状态和 Convex 数据层，目标是在手机上提供轻量的文档管理与 AI 知识助手体验。

## 核心能力

- **移动文档工作区**：支持文档树、最近文档、回收站、收藏、归档、搜索和文档编辑。
- **富文本编辑**：基于 TenTap/TipTap 构建移动端编辑器，适配 React Native 交互。
- **AI Chat**：通过服务端代理访问 LLM，支持知识库开关、深度思考、会话管理和失败重试。
- **跨端共享**：复用 `@notion/ai`、`@notion/business`、`@notion/convex`，减少 Web/Mobile 重复实现。
- **安全代理**：移动端图片上传通过 Web API 转发到 EdgeStore，AI 请求通过服务端代理，客户端不暴露敏感密钥。
- **原生体验**：支持 Expo Router、Tamagui、主题切换、Haptics、手势与原生动画。

## 技术栈

| 层级 | 技术 |
|---|---|
| 移动框架 | Expo 54, React Native 0.81, TypeScript |
| 路由 | Expo Router 6 |
| UI | Tamagui 2, React Native Reanimated, Gesture Handler |
| 编辑器 | TenTap / TipTap |
| 数据与认证 | Convex, Clerk Expo |
| AI | 服务端代理 + `@notion/ai` 共享逻辑 |
| 状态与国际化 | Zustand, i18next, react-i18next |
| 构建 | EAS Build |

## 快速开始

```bash
# 根目录安装依赖
pnpm i

# 启动 Mobile
pnpm start:mobile

# 或进入 Mobile 包启动
cd apps/mobile
pnpm dev
```

本地 AI 服务调试：

```bash
cd apps/mobile
pnpm dev:local
```

构建 Android Preview：

```bash
cd apps/mobile
pnpm build:preview
```

## 环境变量

在 `apps/mobile/.env` 中配置：

```env
CONVEX_DEPLOYMENT=your-convex-deployment
EXPO_PUBLIC_CONVEX_URL=your-convex-url
EXPO_PUBLIC_CONVEX_SITE_URL=your-convex-site-url

EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
```

AI 服务地址由运行模式决定：

| 场景 | AI 地址 |
|---|---|
| `pnpm dev` | 默认线上 AI 服务 |
| `pnpm dev:local` | `http://localhost:3000` |
| EAS preview / production | 线上 AI 服务 |

真机调试本地 AI 时，需要将 `localhost` 替换为局域网 IP。

## 架构说明

```text
Mobile App
  ├─ Expo Router 页面路由
  ├─ Tamagui / RN 组件层
  ├─ TenTap 文档编辑器
  ├─ AI Chat UI
  └─ Convex / Clerk 客户端

共享包
  ├─ @notion/ai：AI Chat、RAG、工具与服务端类型
  ├─ @notion/business：AI 设置、知识库开关、i18n、业务类型
  └─ @notion/convex：Documents、Chat、Schema 共享逻辑

服务端代理
  ├─ Mobile -> Web API -> EdgeStore
  └─ Mobile -> AI Gateway / Vercel Edge Function -> LLM API
```

## 目录结构

```text
apps/mobile/
├── app/                         # Expo Router 文件路由
│   ├── (auth)/                  # 登录/注册
│   ├── (home)/                  # 首页、文档、回收站
│   └── src/
│       ├── components/          # 通用 UI 组件
│       ├── features/            # ai-chat、home 等业务模块
│       ├── hooks/               # 通用 Hooks
│       ├── i18n/                # i18next 配置
│       ├── lib/                 # AI/Convex 客户端
│       └── theme/               # 主题 Provider
├── convex/                      # Convex 后端入口，复用 @notion/convex
├── assets/                      # 静态资源
├── app.json                     # Expo 配置
├── eas.json                     # EAS 构建配置
└── tamagui.config.ts            # Tamagui 主题配置
```

## 当前重点

- 移动端基础文档与 AI Chat 能力已跑通，并已接入跨端共享业务状态、Convex 数据层和服务端安全代理。
- 2026-06-12 当前 CLI/Skills/MCP 已发布到 `latest`，Web Agent 已具备流式续跑、tool-result-v1、Memory/RAG 和确认式写入能力；Mobile 下一阶段主线转向“偏客户端学习与建设”，用真实移动端能力补齐 AI Native 客户端架构。
- 后续重点包括 Mobile Agent Stream 接入、checkpoint/resume、AI Chat 状态机、正文图片上传验证与补强、移动端编辑器深水区、离线缓存、弱网恢复、文档树查询优化、TestFlight/应用商店发布和推送通知。

## 下一阶段客户端学习主线

目标不是单独学习移动端教程，而是在 My-Notion Mobile 中完成一条真实客户端工程路线：

1. **Agent Stream MVP**：接入 Web `/api/agent/stream`，解析 NDJSON 事件，先跑通 `run-start -> text-delta -> checkpoint -> finish/error`。
2. **AI Chat 状态机**：支持停止生成、失败重试、继续生成、生成中禁用关键操作，并为 tool call / write preview 预留状态结构。
3. **Resume 与本地缓存**：保存 `runId`、`lastAppliedSeq`、`assistantMessageId`、输入草稿和最近会话，支持网络恢复后的续跑。
4. **移动编辑器深水区**：验证并补强正文图片插入/上传，梳理复杂 block 的可编辑/只读降级策略，优化键盘避让、选区和长文编辑。
5. **客户端质量收口**：补真机验证、弱网验证、错误边界、日志与性能检查。

详细计划见 [`../../docs/web-mobile-gap-analysis.md`](../../docs/web-mobile-gap-analysis.md)。

## 关联文档

- 当前 Web / Mobile 差距与 backlog 见 [`../../docs/web-mobile-gap-analysis.md`](../../docs/web-mobile-gap-analysis.md)。
- Agent 当前路线见 [`../../docs/ai-chat-refactor-plan.md`](../../docs/ai-chat-refactor-plan.md)。

## 注意事项

- Clerk 需要在控制台正确配置移动端应用。
- 修改 `.env` 后建议执行 `npx expo start --clear` 清理 Metro 缓存。
- 部分能力如 Haptics、文件上传、相册权限等需要真机验证。
- 国内网络环境下 `.vercel.app` 可能不可达，生产建议绑定自定义域名或使用可访问代理域名。
