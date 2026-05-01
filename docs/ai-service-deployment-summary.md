# AI Service Deployment Summary

## 背景

本次排查的目标，是解决 `mobile` 端接入独立 `AI Service` 后，线上请求长期无响应的问题。  
当前 `mobile` 的 AI 请求会发往独立域名 `my-notion-ai.vercel.app`，而不是复用 `web` 端自身的 API Route。

## 问题现象

- `mobile` 文档相关功能正常。
- `mobile` 的 AI 请求异常，表现为浏览器网络面板中请求长期 pending。
- 最终线上 `POST /api/chat` 在 Vercel 上返回 `504 FUNCTION_INVOCATION_TIMEOUT`。
- `GET /api/health` 最终可以恢复为正常返回 `{"status":"ok"}`。
- `OPTIONS /api/chat` 能返回 `204`，说明预检请求和 CORS 基本正常。

## 关键结论

### 1. 问题不在 mobile 前端

`mobile` 本身的请求逻辑没有发现根本性错误。  
真正的问题出在：

`mobile -> services/ai -> DashScope(OpenAI 兼容接口)`

这条线上链路。

### 2. 问题不在文档功能

文档功能主要走 `Convex`，而 AI 功能走独立部署的 `services/ai`。  
因此出现了“文档正常，但 AI 不正常”的现象。

### 3. 问题不只是 CORS

最开始浏览器表面上报的是 CORS / fetch 错误，但进一步验证后发现：

- `OPTIONS /api/chat` 正常
- 真正失败的是 `POST /api/chat`

所以 CORS 不是根因，只是请求失败后的表层表现。

### 4. 问题不只是路由或部署入口

前期确实存在部署与入口问题，已经逐步修复：

- `/api/health` 从最初的 `404` 恢复为 `200`
- 解决了 Vercel 上的路由挂载问题
- 解决了 `ESM/CJS` 加载问题
- 解决了 workspace 依赖在运行时找不到的问题

这些修复说明服务已经能被正确部署和调用。

### 5. 当前剩余的核心问题

当前剩余的核心问题是：

**`services/ai` 在线上环境调用 DashScope 时，`POST /api/chat` 长时间无首包，最终被 Vercel 强制超时。**

这意味着：

- 不是前端问题
- 不是健康检查问题
- 不是预检问题
- 不是单纯函数没起来

而是 **线上 AI 出口链路本身不稳定或卡死**

## 已尝试的修复

### 1. 修正 Vercel 路由与入口

已完成以下修复：

- 调整 `services/ai` 的 Hono 路由前缀
- 修正 Vercel catch-all API 入口
- 清理错误的 `vercel.json` 重写规则

结果：

- `GET /api/health` 可正常访问

### 2. 修正构建与模块系统问题

已处理：

- `Cannot use import statement outside a module`
- `ERR_MODULE_NOT_FOUND`
- workspace 包 `@notion/ai` 在运行时找不到源码导出

处理方式包括：

- 调整 `CommonJS/ESM` 兼容方案
- 使用构建产物运行服务
- 修正编译路径与运行时依赖

结果：

- 本地 `pnpm build` 正常
- 本地 `pnpm start` 正常
- 线上 `api/health` 可正常工作

### 3. 增加 `/api/chat` 调试能力

为 `/api/chat` 补充了：

- 分阶段日志
- 首包超时保护

目标是区分：

- 请求是否进入服务
- 是否开始调用模型
- 是否拿到上游首包
- 是否卡在模型流式返回阶段

### 4. 调整 Vercel Function Region

最初线上函数实际运行在：

- `iad1`

后续将执行区域改为：

- `hkg1`

并确认该配置已经生效。

## 为什么 web 正常但 mobile 不正常

`web` 端 AI 功能主要走自身应用内的 API Route，和 `mobile` 使用的独立 `services/ai` 不是同一条部署链路。

因此：

- `web` 正常，不代表 `services/ai` 正常
- `mobile` 的问题必须单独排查 `services/ai`

## 当前判断

即使将 Vercel Function Region 调整到 `hkg1` 后，`POST /api/chat` 仍然可能在 300 秒后超时。  
这说明：

- 区域问题确实存在过
- 但区域不是唯一根因

目前最可信的判断是：

**Vercel 上的 `services/ai` 调用 DashScope 的链路仍然不稳定，不适合作为当前 `mobile` AI 的长期生产承载方式。**

## 推荐方案

### 方案 A：继续留在 Vercel

优点：

- 保留现有平台
- 不需要迁移域名和服务商

缺点：

- 当前已经验证存在不稳定问题
- 后续仍需继续排查 Vercel 运行环境与 DashScope 的兼容性

### 方案 B：迁移到可控区域平台

这是当前更推荐的方案。

原因：

- 可以明确控制运行区域
- 能绕开 Vercel 当前这条不稳定链路
- 更适合承载依赖 DashScope 的 AI 出口服务

已为此准备最小改动配置：

- `services/ai/Dockerfile`
- `services/ai/fly.toml`
- `.dockerignore`

目标平台为：

- `Fly.io`
- 主区域：`sin`

这种方案保留当前 `services/ai` 的 Node/Hono 运行方式，不改业务代码，只补部署配置。

## 当前建议

如果目标是尽快恢复 `mobile` AI 的稳定可用性，建议优先执行：

**迁移 `services/ai` 到可控区域平台，而不是继续把生产可用性押在 Vercel 这条链路上。**

如果目标是继续研究 Vercel 根因，则下一步需要进一步收集：

- `POST /api/chat` 对应的完整 console logs
- 新增阶段日志是否已经打出
- 上游模型请求在 `hkg1` 下的首包行为

## 一句话总结

本次排查已经确认：

- `mobile` 代码不是根因
- `Convex` 文档链路不是根因
- CORS 不是根因
- 路由与部署入口问题已基本修复

当前真正未解决的问题只剩一个：

**`services/ai` 在 Vercel 上调用 DashScope 的生产链路仍然会卡死并超时。**
