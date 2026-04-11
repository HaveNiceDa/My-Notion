# My-Notion Monorepo

基于现代前端与 AI 技术栈构建的个性化 Notion 应用项目。

## 📦 项目结构

```
My-Notion/
├── apps/                          # 应用层
│   └── web/                       # Next.js Web 应用
│
├── packages/                      # 共享包
│   └── business/                  # 业务共享包
│       └── i18n/                  # 国际化翻译文件
│
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 🚀 快速开始

### 前提条件

- Node.js 22.0 或更高版本
- pnpm 包管理器

### 安装

```bash
pnpm i
```

### 开发

```bash
# 启动 Web 应用
cd apps/web
pnpm start
```

### 构建

```bash
# 构建 Web 应用
pnpm build:web
```

## 🎯 架构规划（进行中）

本项目正在按照 Monorepo 架构进行重构，计划支持：

- **Web 端**：Next.js 应用（已实现）
- **移动端**：React Native 应用（规划中）
- **AI Gateway**：独立的 AI 网关服务（规划中）
- **共享包**：类型定义、AI 工具、Convex Hooks、UI 组件等（部分实现）

详细规划请参考。

## 📝 各应用说明

- [Web 应用](./apps/web/README.md) - 基于 Next.js 的 Notion Web 应用
