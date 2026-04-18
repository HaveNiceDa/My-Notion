# My-Notion Mobile

基于 Expo 的 Notion 克隆移动应用，提供类似 Notion 的文档管理和移动端体验。

## 功能特性

- 📝 **文档管理**：支持文档的创建、编辑和管理
- 🔐 **用户认证**：使用 Clerk 实现安全的用户登录和注册
- 🗄️ **数据存储**：使用 Convex 作为后端数据库，提供实时数据同步
- 🎨 **主题色切换**：支持亮色和深色主题切换
- 🌐 **多语言支持**：集成 i18next 实现多语言支持（中、英、繁体）
- 📱 **移动端优化**：适配 iOS 和 Android 的原生体验
- 🤖 **AI 智能对话**：基于 RAG 技术的移动端 AI 助手功能

## 技术栈

### 前端

- **Expo** 54 - 现代化 React Native 开发框架
- **React Native** 0.81 - 移动端跨平台框架
- **Expo Router** 6 - 基于文件系统的路由
- **Tamagui** 2.0 - 高性能 UI 组件库
- **React Native Reanimated** 4.1 - 流畅动画库
- **React Native Gesture Handler** 2.28 - 手势处理
- **Clerk** - 用户认证和管理
- **i18next** - 国际化解决方案

### 后端

- **Convex** - 实时后端数据库

## 快速开始

### 前提条件

- Node.js 20.0 或更高版本
- pnpm 包管理器
- Expo CLI
- Convex 账号
- Clerk 账号

### 安装步骤

1. **克隆仓库**

   ```bash
   git clone https://github.com/HaveNiceDa/Notion.git
   cd notion/apps/mobile
   ```

2. **安装依赖**

   ```bash
   pnpm install
   ```

3. **配置环境变量**
   创建 `.env.local` 文件并添加以下环境变量：

   ```env
   # Convex
   CONVEX_DEPLOYMENT=your-convex-deployment
   EXPO_PUBLIC_CONVEX_URL=your-convex-url
   EXPO_PUBLIC_CONVEX_SITE_URL=your-convex-site-url

   # Clerk
   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
   ```

4. **启动开发服务器**

   ```bash
   pnpm start
   ```

   或者分别启动：

   ```bash
   pnpm run dev    # 启动 Expo 开发服务器
   npx convex dev  # 启动 Convex 后端
   ```

   在终端中，选择运行平台：
   - 按 `i` 启动 iOS 模拟器
   - 按 `a` 启动 Android 模拟器
   - 按 `w` 启动 Web

## 环境变量配置

### Convex

- `CONVEX_DEPLOYMENT` - Convex 部署 ID
- `EXPO_PUBLIC_CONVEX_URL` - Convex 应用 URL
- `EXPO_PUBLIC_CONVEX_SITE_URL` - Convex 站点 URL

### Clerk

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk 可发布密钥

## 项目结构

```
mobile/
├── app/                          # Expo Router 应用目录
│   ├── (auth)/                   # 认证页面
│   ├── (home)/                  # 首页路由
│   ├── _layout.tsx              # 根布局
│   └── index.tsx                # 入口页面
├── app/src/
│   ├── components/               # 可复用组件
│   ├── features/                 # 功能模块
│   │   ├── ai-chat/             # AI 聊天功能
│   │   └── home/                # 首页功能
│   ├── hooks/                    # 自定义 Hooks
│   ├── i18n/                     # 国际化相关
│   ├── theme/                    # 主题配置
│   └── lib/                      # 工具函数库
├── convex/                        # Convex 后端
├── assets/                        # 静态资源
└── README.md
```

## 注意事项

- **Clerk 配置**：确保在 Clerk 控制台中正确配置移动端应用
- **Convex 部署**：运行 `npx convex dev` 确保 Convex 后端正确部署
- **平台特定**：部分功能（如 Haptics）仅在真机上可用
- **React Native 版本**：确保与 Expo SDK 版本兼容
