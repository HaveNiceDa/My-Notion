# My-Notion Mobile

基于 Expo 54 + React Native 0.81 的 Notion 克隆移动应用，与 Web 端共享 AI、业务逻辑和 Convex 数据层。

## ✨ 核心特性

### 文档管理
- 📝 **文档编辑** — 基于 TenTap (TipTap) 的富文本编辑器
- 📁 **文档树导航** — 侧边栏文档树 + 面包屑导航
- 🔍 **快速搜索** — 全局文档搜索
- ⭐ **收藏 & 归档** — 文档收藏、归档、恢复
- 🎨 **封面图 & 图标** — 通过 Web API 代理上传至 EdgeStore

### AI 智能对话
- 🤖 **RAG 对话** — 通过 Vercel Edge Function 代理，API Key 安全隐藏
- 💬 **SSE 流式响应** — Web 端 `ReadableStream` 逐块读取，Native 端 `response.text()` 兼容方案
- 🧠 **深度思考** — 思考过程可视化
- 🔍 **知识库检索** — 知识库搜索步骤可视化
- 🔄 **失败重试** — 发送失败后一键重试
- 💡 **快捷建议** — 空状态下的推荐提问气泡
- 🗑️ **会话管理** — 删除确认弹窗、自动标题更新

### 跨端共享
- 📦 **@notion/ai** — RAG、Chat、Embeddings 逻辑复用
- 📦 **@notion/business** — AI 模型/知识库/深度思考 Zustand Store 共享
- 📦 **@notion/convex** — Documents/Chat 业务逻辑共享，零重复代码

### 体验优化
- 🌙 **主题切换** — 亮色/深色主题
- 🌐 **多语言** — i18next 中/英/繁体
- 📱 **原生体验** — Haptics 反馈、手势操作、原生动画

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **框架** | Expo | 54 |
| **UI 库** | React Native | 0.81 |
| **路由** | Expo Router | 6 |
| **UI 组件** | Tamagui | 2.0 RC |
| **动画** | React Native Reanimated | 4.1 |
| **手势** | React Native Gesture Handler | 2.28 |
| **认证** | Clerk (Expo) | 3.x |
| **数据库** | Convex | 1.31+ |
| **编辑器** | TenTap (TipTap) | 1.0 |
| **状态管理** | Zustand | 5.x |
| **国际化** | i18next + react-i18next | 26.x |
| **AI 网关** | Vercel Edge Function (代理) | — |

## 快速开始

### 前提条件
- Node.js 22.0+
- pnpm 10+
- Expo CLI
- Convex 账号
- Clerk 账号

### 安装步骤

1. **克隆仓库**
   ```bash
   git clone https://github.com/HaveNiceDa/My-Notion.git
   cd My-Notion
   pnpm i
   ```

2. **配置环境变量**
   在 `apps/mobile/` 下创建 `.env` 文件：
   ```env
   # Convex
   CONVEX_DEPLOYMENT=your-convex-deployment
   EXPO_PUBLIC_CONVEX_URL=your-convex-url
   EXPO_PUBLIC_CONVEX_SITE_URL=your-convex-site-url

   # Clerk
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
   ```

3. **启动开发服务器**
   ```bash
   cd apps/mobile

   # 默认走线上 AI 服务
   pnpm dev

   # 走本地 AI 源码（需同时启动 services/ai）
   pnpm dev:local
   ```
   在终端中选择运行平台：
   - 按 `i` 启动 iOS 模拟器
   - 按 `a` 启动 Android 模拟器

4. **构建 Android APK**
   ```bash
   pnpm build:preview
   ```

## 项目结构

```
mobile/
├── app/                          # Expo Router 文件路由
│   ├── (auth)/                   # 认证页面 (登录/注册/第三方)
│   ├── (home)/                   # 主页路由
│   │   ├── document/[documentId] # 文档编辑页
│   │   ├── index.tsx             # 首页
│   │   └── trash.tsx             # 回收站
│   ├── src/
│   │   ├── components/           # 通用 UI 组件
│   │   ├── features/
│   │   │   ├── ai-chat/          # AI 聊天模块 (ChatModal)
│   │   │   └── home/             # 首页功能模块
│   │   │       ├── components/   # 首页组件 (侧边栏/搜索/文档树...)
│   │   │       └── hooks/        # 文档树/最近文档 Hooks
│   │   ├── hooks/                # 通用 Hooks
│   │   ├── i18n/                 # i18next 配置
│   │   ├── lib/
│   │   │   ├── ai/               # AI 聊天客户端
│   │   │   └── convex/           # Convex 客户端
│   │   └── theme/                # 主题 Provider
│   ├── _layout.tsx               # 根布局
│   └── index.tsx                 # 入口
├── convex/                       # Convex 后端 (入口导出 @notion/convex)
├── assets/                       # 静态资源
├── app.json                      # Expo 配置
├── tamagui.config.ts             # Tamagui 主题配置
└── eslint.config.js              # ESLint 配置
```

## 架构说明

### 图片上传代理

Mobile 端文件上传通过 Web 端 API 代理转发至 EdgeStore，避免在客户端暴露密钥：

```
Mobile → Web API (/api/upload-image) → EdgeStore
```

### AI 调用代理

Mobile 端 AI 请求通过 Vercel Edge Function 代理，API Key 仅存储在服务端：

```
Mobile → Vercel Edge Function (/api/chat) → DashScope LLM API
```

SSE 流式响应按平台分流：Web 端使用 `ReadableStream` 逐块读取实现真正流式，Native 端使用 `response.text()` 一次性读取确保兼容性。

### 环境变量管理

| 文件/配置 | AI 地址 | 场景 |
|---|---|---|
| `.env` | `https://my-notion-ai.vercel.app` | 默认走线上 |
| `pnpm dev:local` | `http://localhost:3001`（行内覆盖） | 走本地 AI 源码 |
| `eas.json` preview/production | `https://my-notion-ai.vercel.app` | EAS 云端构建 |

真机调试本地 AI 时，需将 `localhost` 替换为局域网 IP（如 `http://192.168.x.x:3001`）。

### 状态管理

AI 核心状态（模型选择、知识库开关、深度思考）使用 `@notion/business` 共享 Zustand Store，Web/Mobile 行为一致。

## 🗺️ Roadmap

### ✅ 已完成

- **EAS Build Android** — Preview APK 打包通过，`eas.json` 环境变量配置完成
- **AI 服务 Edge Runtime** — 从 Hono Serverless 迁移至 Vercel 原生 Edge Function
- **SSE 平台分流** — Web 端 `ReadableStream` 流式，Native 端 `response.text()` 兼容
- **环境变量管理** — `dev:local` 命令行内覆盖，EAS 构建走线上域名
- **Error Boundary** — 生产模式错误捕获，Clerk 加载状态优化

### 📱 应用商店上线

- **Mobile 自定义域名** — AI 服务绑定自定义域名，解决国内 `.vercel.app` 不可达问题
- **iOS App Store** — TestFlight 内测 → 正式发布
- **Android Google Play** — 内部测试 → 公开发布
- **原生体验打磨** — 推送通知、离线缓存、手势交互优化

### 🤖 AI 能力对齐

与 Web 端 AI 原生编辑器能力对齐：

- **选中即 AI** — 长按选中文字，弹出 AI 操作菜单（翻译、润色、提问）
- **Inline AI** — 输入区 AI 辅助建议
- **RAG 增强** — 分层检索、混合检索、多格式文档支持

## 注意事项

- **Clerk 配置**：确保在 Clerk 控制台中正确配置移动端应用
- **Convex 部署**：运行 `npx convex dev` 确保 Convex 后端正确部署
- **平台特定**：部分功能（如 Haptics）仅在真机上可用
- **Web API 依赖**：图片上传功能需要 Web 端服务运行中
- **国内网络**：`.vercel.app` 域名在国内可能不可达，真机测试需开代理或绑定自定义域名
- **Metro 缓存**：修改 `.env` 后需 `npx expo start --clear` 清缓存
