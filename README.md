# My-Notion

## 🚀 体验地址

[https://notion-j9zj.vercel.app/](https://notion-j9zj.vercel.app/)

基于现代前端技术栈构建的个人化 Notion 应用，提供类似 Notion 的文档编辑和管理功能。核心特点包括富文本编辑、主题色切换、国际化支持、用户认证、实时数据同步、文件上传、响应式设计等。

## 功能特性

- 📝 **富文本编辑器**：基于 BlockNote 的强大编辑器，支持多种内容格式
- 🔐 **用户认证**：使用 Clerk 实现安全的用户登录和注册
- 🗄️ **数据存储**：使用 Convex 作为后端数据库，提供实时数据同步
- 📤 **文件上传**：集成 Edge Store 支持图片等文件上传
- 🎨 **响应式设计**：适配不同屏幕尺寸的现代 UI
- 🌙 **主题色切换**：支持亮色和深色主题切换
- 🌐 **国际化支持**：多语言翻译支持（中、英、繁体已经上线，还有些文案在查漏补缺）
- 🔍 **文档搜索**：快速搜索和定位文档
- 📁 **文档管理**：支持文档的创建、编辑、归档和删除

## 技术栈

### 前端

- **Next.js** 16 - 现代化 React 框架
- **React** 19 - 用户界面库
- **TypeScript** - 类型安全的 JavaScript
- **Tailwind CSS** - 实用优先的 CSS 框架
- **BlockNote** - 富文本编辑器
- **Shadcn UI** - 基于 Radix UI 的可访问性组件库
- **Clerk** - 用户认证和管理
- **Sonner** - 优雅的通知系统

### 后端

- **Convex** - 实时后端数据库
- **Edge Store** - 边缘存储服务

## 快速开始

### 前提条件

- Node.js 22.0 或更高版本
- pnpm 包管理器
- Convex 账号
- Clerk 账号
- Edge Store 账号

### 安装步骤

1. **克隆仓库**

   ```bash
   git clone https://github.com/HaveNiceDa/Notion.git
   cd notion
   ```

2. **安装依赖**

   ```bash
   pnpm i
   ```

3. **配置环境变量**

   创建 `.env.local` 文件并添加以下环境变量：

   ```env
   # Convex
   CONVEX_DEPLOYMENT=your-convex-deployment
   NEXT_PUBLIC_CONVEX_URL=your-convex-url

   # Clerk
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
   CLERK_SECRET_KEY=your-clerk-secret-key
   CLERK_JWT_ISSUER_DOMAIN=your-clerk-jwt-issuer-domain

   # Edge Store
   EDGE_STORE_ACCESS_KEY=your-edge-store-access-key
   EDGE_STORE_SECRET_KEY=your-edge-store-secret-key
   ```

4. **启动开发服务器**

   ```bash
   # 启动 Convex 开发服务器（新终端）
   npx convex dev

   # 启动 Next.js 开发服务器
   pnpm run dev
   ```

   应用将在 `http://localhost:3000` 运行。

## 环境变量配置

### Convex

- `CONVEX_DEPLOYMENT` - Convex 部署 ID
- `NEXT_PUBLIC_CONVEX_URL` - Convex 应用 URL

### Clerk

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk 可发布密钥
- `CLERK_SECRET_KEY` - Clerk 密钥
- `CLERK_JWT_ISSUER_DOMAIN` - Clerk JWT 颁发者域

### Edge Store

- `EDGE_STORE_ACCESS_KEY` - Edge Store 访问密钥
- `EDGE_STORE_SECRET_KEY` - Edge Store 密钥

## 项目结构

```
notion/
├── src/             # 源代码目录
│   ├── app/         # Next.js 应用路由
│   │   ├── [locale]/    # 国际化路由
│   │   │   ├── (main)/      # 主应用布局
│   │   │   ├── (marketing)/ # 营销页面
│   │   │   ├── (public)/    # 公共页面
│   │   │   └── demo/        # 评论区演示页面，调试中
│   │   └── api/         # API 路由
│   ├── components/  # 可复用组件
│   │   ├── modals/       # 模态框组件
│   │   ├── providers/    # 上下文提供者
│   │   ├── ui/           # UI 组件
│   │   ├── Editor.tsx    # 富文本编辑器
│   │   ├── Toolbar.tsx   # 工具栏
│   │   └── Cover.tsx     # 封面组件
│   ├── hooks/       # 自定义 Hooks
│   ├── i18n/        # 国际化相关配置
│   └── lib/         # 工具函数
├── convex/          # Convex 后端
│   ├── _generated/  # 自动生成的代码
│   ├── documents.ts # 文档相关函数
│   ├── schema.ts    # 数据模型定义
│   └── auth.config.ts # 认证配置
├── public/          # 静态资源
├── next.config.js   # Next.js 配置
├── package.json     # 项目依赖
└── README.md        # 项目文档
```

## 部署指南

### Vercel 部署

1. **连接仓库**：在 Vercel 控制台中连接你的 GitHub 仓库

2. **配置环境变量**：在 Vercel 项目设置中添加所有必要的环境变量

3. **部署**：点击 "Deploy" 按钮开始部署

4. **配置域名**：（可选）添加自定义域名

### 其他部署平台

对于其他部署平台，请参考相应平台的文档，并确保正确配置环境变量。

## 注意事项

- **Clerk 配置**：确保在 Clerk 控制台中正确配置应用，特别是 JWT 颁发者域
- **Convex 部署**：运行 `npx convex dev` 确保 Convex 后端正确部署
- **Edge Store 配置**：确保 Edge Store 访问密钥和密钥正确配置
- **React 19/Next 16 严格模式**：BlockNote 目前尚不兼容 React 19 / Next 16 的 StrictMode 模式，请暂时禁用 StrictMode 模式

## 最近更新

- **支持目录文件移动到任意目录**：现在可以更灵活地组织文档结构，将目录文件移动到任何其他目录中
- **文章目录导航功能**：在文章左上角实现了目录导航，显示文件层级结构，支持跳转到上级目录

## 近期支持 TODO

我们计划在近期版本中优先完成以下任务：

1. **修复文档拖拽 bug**：解决移动侧边栏文件到编辑区时 id 被带入编辑器的问题
2. **页面切换流畅性提升**：优化路由切换动画，减少页面加载时间
3. **更换文章标题图片时的骨架屏效果**：添加更美观的加载状态，提升用户体验
4. **编辑器性能优化**：优化 BlockNote 编辑器的渲染性能，支持更大文档
5. **响应式设计改进**：进一步优化移动设备上的用户体验
6. **错误处理增强**：添加更友好的错误提示和恢复机制
7. **代码分割优化**：减少首屏加载时间，提升应用启动速度

## 未来支持计划

我们计划在未来版本中添加以下功能：

1. **国际化**：支持更多语言翻译，如日语、韩语、法语等
2. **文章内部搜索替换功能**：支持在文章内部快速搜索和替换文本
3. **AI 总结文章内容**：利用 AI 技术自动总结文章的主要内容
4. **更多编辑器功能**：添加更多富文本编辑功能，如表格、图表、数学公式等
5. **多人协作功能**：支持多人实时协作编辑文档（计划中）
6. **文档侧边栏评论区**：在文档侧边栏添加评论功能，支持对特定内容进行评论和讨论
7. **@人能力**：支持在编辑器和评论中@提及其他用户
8. **更多主题**：提供更多美观的编辑器主题选择

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 联系方式

如果有任何问题或建议，欢迎联系项目维护者。
