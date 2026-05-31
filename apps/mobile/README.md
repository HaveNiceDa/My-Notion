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
| `pnpm dev:local` | `http://localhost:3001` |
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
- 2026-05-31 当前 CLI/Skills/MCP 已发布 beta，项目主线转向 Web Agent 的 Plan/Spec/MCP adapter 产品化；Mobile 近期保持能力基线，后续重点对齐 Web 端 RAG、Tool、正文图片上传和文档树性能。
- 后续重点包括 Mobile AI 架构统一、知识库 RAG、Tool/Web Search 能力边界、正文图片上传、文档树查询优化、TestFlight/应用商店发布、离线缓存和推送通知。

## 关联文档

- 当前 Web / Mobile 差距与 backlog 见 [`../../docs/web-mobile-gap-analysis.md`](../../docs/web-mobile-gap-analysis.md)。
- Agent 当前路线见 [`../../docs/ai-chat-refactor-plan.md`](../../docs/ai-chat-refactor-plan.md)。

## 注意事项

- Clerk 需要在控制台正确配置移动端应用。
- 修改 `.env` 后建议执行 `npx expo start --clear` 清理 Metro 缓存。
- 部分能力如 Haptics、文件上传、相册权限等需要真机验证。
- 国内网络环境下 `.vercel.app` 可能不可达，生产建议绑定自定义域名或使用可访问代理域名。
