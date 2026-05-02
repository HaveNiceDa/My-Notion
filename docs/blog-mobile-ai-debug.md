# Mobile 端 AI 请求真机调试：从"线上没日志"到四层问题定位

> 同一个 Mobile 项目，`expo start --web` 跑得好好的，真机扫码后 AI 对话一直转圈，Vercel 线上日志一条都没有。请求根本没到服务端，但原因远不止"网络不通"这么简单。这篇文章从一次真机调试讲起，把 Vercel 路由冲突、Edge Runtime 识别、SSE 平台分流、环境变量管理、国内网络限制五个层面的问题一次性讲清楚。

## 1. 开篇：Web 能用，真机不行

我的项目是一个 AI 原生的类 Notion 应用，Web 端和 Mobile 端共享同一套 AI 请求逻辑。某天我在真机上测试 Mobile 端的 AI 对话功能，发送消息后一直转圈，最终走到 `onError` 回调。

切到 Web 端（`expo start --web`），同样的代码、同样的 AI 服务地址，一切正常。

更诡异的是——Vercel 线上日志里一条请求记录都没有。请求像凭空消失了一样。

**"线上没日志"意味着两种可能：请求根本没到服务端，或者请求到了但没进入业务代码。** 这个判断成了后续排查的分水岭。

## 2. 前景提要：项目的 AI 请求架构

在讲问题之前，先交代一下项目的 AI 请求链路，因为后面的每个问题都和这个架构有关。

### 2.1 Monorepo 结构

```
My-Notion/
├── apps/
│   ├── web/              # Next.js Web 应用
│   └── mobile/           # Expo React Native 应用
├── packages/
│   ├── ai/               # AI 核心逻辑（共享）
│   ├── business/         # 业务状态（共享）
│   └── convex/           # 数据库逻辑（共享）
└── services/
    └── ai/               # AI 网关（独立部署到 Vercel）
        ├── api/
        │   ├── chat.ts   # /api/chat 入口
        │   └── [[...route]].js  # catch-all 路由
        └── src/
            └── index.ts  # Hono 主应用
```

### 2.2 AI 请求链路

```
Mobile App
  └─ fetch("https://my-notion-ai.vercel.app/api/chat")
       └─ Vercel (services/ai)
            └─ DashScope (阿里云 AI 服务)
```

Mobile 端直接请求 `services/ai` 部署在 Vercel 上的 API，不经过 Web 端的 Next.js。这是因为 Expo React Native 不走 Next.js 的 API Route，需要独立的 AI 服务入口。

### 2.3 SSE 流式响应

AI 对话使用 SSE（Server-Sent Events）实现流式输出。但 React Native 对 `ReadableStream` 的支持不完整，需要按平台分流：

```typescript
if (Platform.OS === "web") {
  // Web 端：ReadableStream 逐块读取，实现真正的流式
  const reader = response.body?.getReader();
  // ...
} else {
  // Native 端：response.text() 一次性读取
  const text = await response.text();
  processSSEBuffer(text + "\n", callbacks);
}
```

Web 端能实时看到 AI 逐字输出，Native 端则是等 DashScope 完全响应后一次性显示——不流式，但能用。

## 3. 第一层：Vercel 路由冲突——请求到了，但进不了业务代码

### 3.1 发现问题

`services/ai/api/` 目录下有两个文件：

- **`api/chat.ts`** — Hono 格式，声明了 `export const runtime = "edge"` 和 `export default app`
- **`api/[[...route]].js`** — Serverless catch-all，内容是：

```javascript
const { handle } = require("@hono/node-server/vercel");
const app = require("../dist/services/ai/src/index.js").default;
module.exports = handle(app);
```

Vercel 的路由解析规则是：**catch-all `[[...route]]` 会匹配所有 `/api/*` 请求**，包括 `/api/chat`。

这意味着，即使 `chat.ts` 声明了 `export const runtime = "edge"`，Vercel 也不会把它当作独立的 Edge Function——因为 `[[...route]].js` 已经接管了 `/api/chat` 这个路由。

### 3.2 为什么 Web 端不受影响

Web 端有自己的 Next.js Route Handler 处理 `/api/chat`，根本不走 `services/ai` 的 Vercel 部署。所以 Web 端从来没触发过这个路由冲突。

### 3.3 catch-all 的问题

`[[...route]].js` 是 Node.js Serverless 函数，它 `require("../dist/services/ai/src/index.js")`。而 `src/index.ts` 使用了：

```typescript
import "dotenv/config";
import { randomUUID } from "crypto";
```

这些是 Node.js 专用模块。在 Serverless Runtime 中：

- 如果 `dist/` 没有正确构建，`require` 直接失败 → 请求 500/502
- 即使 `dist/` 存在，Serverless 函数到 DashScope 国内节点的网络不稳定，可能超时

**无论哪种情况，请求都不会进入 `chat.ts` 的业务代码，所以 Vercel 日志里看不到你的业务日志。**

### 3.4 修复：删除 catch-all，改为原生 Edge Function

**删除 `api/[[...route]].js`**，让 `api/chat.ts` 作为独立 Edge Function 被 Vercel 识别。

同时将 `api/chat.ts` 从 Hono 格式改为 Vercel 原生 Edge Function 格式：

```typescript
// 之前：Hono 格式
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
const app = new Hono().basePath("/api");
app.post("/chat", async (c) => { ... });
export default app;

// 之后：Vercel 原生 Edge Function
export const runtime = "edge";
export async function POST(request: Request): Promise<Response> { ... }
```

关键区别：

| | Hono 格式 | Vercel 原生格式 |
|---|---|---|
| 入口 | `export default app` | `export async function POST` |
| Runtime 识别 | 可能被 catch-all 劫持 | Vercel 直接识别为 Edge Function |
| SSE 输出 | `streamSSE()` (Hono API) | `new ReadableStream()` (Web 标准) |
| CORS | `app.use("*", cors())` | 手动处理 OPTIONS + 响应头 |

### 3.5 SSE 输出格式的变化

Hono 的 `streamSSE` 输出格式：

```
event: content
data: {"type":"content","text":"..."}

```

原生 `ReadableStream` 手动编码的格式：

```
event: content
data: {"type":"content","text":"..."}

```

格式完全一致——客户端的 `processSSEBuffer` 按 `data:` 前缀解析，忽略 `event:` 行，解析 JSON 里的 `type` 字段来分发。**客户端代码无需任何修改。**

## 4. 第二层：环境变量管理——本地开发走线上还是走本地

### 4.1 问题

检查 `.env` 发现：

```
EXPO_PUBLIC_AI_SERVICE_URL=https://my-notion-ai.vercel.app
```

本地开发时 AI 请求直接打到 Vercel 线上服务，而不是本地 `services/ai` 源码。如果改了 AI 逻辑想验证，必须先推代码等 Vercel 部署——开发效率极低。

### 4.2 Expo 环境变量优先级

Expo 遵循 `.env.local` > `.env.production` > `.env` 的优先级。之前踩过的坑：

- `.env.local` 覆盖 `.env`，导致本地开发走线上地址
- `.env.production` 在 `--no-dev` 模式下覆盖 `.env`
- `localhost` 在真机上指向手机自身，必须用局域网 IP

### 4.3 修复：启动命令区分本地和线上

`.env` 保持线上域名作为默认值，通过启动命令行内覆盖为本地地址：

```json
{
  "scripts": {
    "dev": "expo start",
    "dev:local": "EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:3001 expo start",
    "dev:all": "concurrently \"pnpm run dev\" \"pnpm run dev:convex\"",
    "dev:all:local": "concurrently \"pnpm run dev:local\" \"pnpm run dev:convex\""
  }
}
```

Expo 的优先级是 `process.env`（行内设置）> `.env` 文件，所以 `dev:local` 的行内变量会覆盖 `.env` 的值。

| 命令 | AI 地址 | 场景 |
|---|---|---|
| `pnpm dev` | `https://my-notion-ai.vercel.app`（读 .env） | 默认走线上 |
| `pnpm dev:local` | `http://localhost:3001`（行内覆盖） | 走本地 AI 源码 |

真机调试时把 `localhost:3001` 换成局域网 IP 即可。

### 4.4 EAS Build 的环境变量

`.env` 在 `.gitignore` 中，EAS 云端构建时无法读取。`EXPO_PUBLIC_` 变量必须在 `eas.json` 的 `env` 字段中显式声明：

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_AI_SERVICE_URL": "https://my-notion-ai.vercel.app"
      }
    },
    "production": {
      "env": {
        "EXPO_PUBLIC_AI_SERVICE_URL": "https://my-notion-ai.vercel.app"
      }
    }
  }
}
```

## 5. 第三层：国内网络限制——.vercel.app 域名被拦截

### 5.1 真相大白

路由冲突修复后，重新部署 `services/ai` 到 Vercel，真机测试——还是不行。

仔细一想：**我的手机没开代理**。

`.vercel.app` 域名在国内被 DNS 污染/网关拦截，请求根本出不去。这就是为什么 Vercel 线上日志一条都没有——请求从手机发出后，在网络层就被拦截了，根本没到 Vercel。

Web 端没问题是因为电脑开了代理。

### 5.2 这个问题的本质

这不是代码问题，而是基础设施问题。在国内使用 Vercel 部署的服务，移动端用户大概率会遇到：

- `.vercel.app` 域名被 DNS 污染，解析失败
- 即使解析成功，HTTPS 连接也可能被网关重置
- 表现为 `fetch` 超时或 `Network request failed`，没有任何服务端日志

### 5.3 长期方案

| 方案 | 复杂度 | 效果 |
|---|---|---|
| 给 `services/ai` 绑自定义域名 + Cloudflare CDN | 中 | 完全解决 |
| 在 `eas.json` 中指向国内可达的代理地址 | 低 | 部分解决 |
| 自建国内服务器部署 AI 服务 | 高 | 完全解决 |

当前阶段，开发测试时开手机代理即可。后续上线需要绑定自定义域名。

## 6. 第四层：SSE 平台分流——Web 和 Native 的 ReadableStream 差异

### 6.1 问题

React Native 对 `ReadableStream` 的支持不完整。Web 端 `response.body.getReader()` 正常工作，但 Native 端可能导致 SSE 流读取卡住，AI 请求一直转圈。

### 6.2 修复：按平台分流

```typescript
async function parseSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<void> {
  if (Platform.OS === "web") {
    await parseSSEStreamWeb(response, callbacks);   // ReadableStream 逐块读取
  } else {
    await parseSSEStreamNative(response, callbacks); // response.text() 一次性读取
  }
}
```

Web 端保持流式体验，Native 端牺牲流式效果换取稳定性。等 React Native 对 `ReadableStream` 的支持完善后，可以统一为流式方案。

### 6.3 Native 端 SSE 解析的注意事项

`response.text()` 会等整个响应完成后才返回。这意味着：

- Native 端 AI 请求会一直等到 DashScope 完全响应后才一次性显示
- 用户看到的是"转圈 → 突然出现完整回复"，而不是"逐字输出"
- 如果 DashScope 响应时间较长，用户可能以为请求卡死了

这是当前方案的已知限制，后续可以通过引入 `react-native-sse` 等第三方库实现原生端的流式体验。

## 7. tsconfig 的隐藏坑：WebWorker lib

### 7.1 问题

将 `api/chat.ts` 改为 Vercel 原生 Edge Function 格式后，使用了 `request.json()`、`new Response()` 等 Web 标准 API。但 `tsconfig.json` 的 `lib` 只有 `["ES2022"]`，缺少 `"WebWorker"`。

TypeScript 不认识 Edge 环境下的 `Request`、`Response`、`crypto.randomUUID()` 等全局类型，编译报错。

### 7.2 修复

```json
{
  "compilerOptions": {
    "lib": ["ES2022", "WebWorker"]
  },
  "include": [
    "api/**/*",
    "src/**/*",
    ...
  ]
}
```

`WebWorker` lib 提供了 Edge Runtime 环境下的类型定义。同时 `include` 中加入 `"api/**/*"`，确保 `api/chat.ts` 被 TypeScript 编译器覆盖。

### 7.3 为什么之前没报错

之前 `api/chat.ts` 使用 Hono 格式，`c.req.json()` 是 Hono 的方法，类型由 Hono 自己提供。改成原生 `request.json()` 后，类型来源从 Hono 切换到了 Web 标准 API，才触发了这个问题。

## 8. vercel.json 的配套修改

### 8.1 之前

```json
{
  "version": 2,
  "buildCommand": "pnpm build",
  "functions": {
    "api/[[...route]].js": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

`functions` 配置的是已删除的 `[[...route]].js`，Edge Function 不需要在这里声明。

### 8.2 之后

```json
{
  "buildCommand": "pnpm build"
}
```

Edge Function 由 Vercel 自动识别（通过 `export const runtime = "edge"` 声明），不需要在 `vercel.json` 中额外配置。

## 9. 完整改动清单

| 文件 | 改动 | 解决的问题 |
|---|---|---|
| `services/ai/api/chat.ts` | Hono 格式 → Vercel 原生 Edge Function | 路由冲突 + Runtime 识别 |
| `services/ai/api/[[...route]].js` | 删除 | 消除 catch-all 路由劫持 |
| `services/ai/vercel.json` | 移除 Serverless 函数配置 | 配套 catch-all 删除 |
| `services/ai/tsconfig.json` | 加 `WebWorker` lib + `api` include | Edge 环境类型定义 |
| `apps/mobile/package.json` | 加 `dev:local` / `dev:all:local` 命令 | 本地开发走本地 AI |
| `apps/mobile/.env` | AI 地址保持线上域名 | 默认走线上，本地开发用命令覆盖 |

## 10. 排查方法论总结

这次调试涉及四个层面的问题，每个层面的排查思路不同：

| 层面 | 现象 | 排查方法 | 根因类型 |
|---|---|---|---|
| 路由层 | 线上无业务日志 | 检查 Vercel 路由文件是否冲突 | 架构设计 |
| 环境变量 | 本地开发走线上 | 检查 `.env` 优先级和实际值 | 配置管理 |
| 网络层 | 请求超时/无响应 | 确认客户端网络环境（代理/DNS） | 基础设施 |
| 运行时 | SSE 解析卡住 | 检查平台 API 兼容性 | 平台差异 |

**关键经验：**

1. **"线上没日志"不等于"请求没到服务端"** — 也可能是请求到了但被错误的路由/函数吞掉了
2. **Web 能用不代表 Native 能用** — `ReadableStream`、CORS、网络环境都有平台差异
3. **环境变量优先级是隐式规则** — `.env.local` 覆盖 `.env` 这种行为，不看文档根本想不到
4. **Vercel 的路由解析有优先级** — catch-all 会劫持具体路由，即使你声明了 `export const runtime = "edge"`
5. **国内 + Vercel = 必须考虑网络可达性** — `.vercel.app` 域名在国内不可达是基础设施问题，不是代码 Bug

## 11. Edge Runtime vs Serverless Runtime

这次调试反复涉及 Vercel 的两种运行时，最后做一个对比：

| | Edge Runtime | Serverless Runtime |
|---|---|---|
| 运行环境 | V8 isolate（类似 Cloudflare Workers） | Node.js（AWS Lambda） |
| 冷启动 | < 1ms | 数百 ms 到数秒 |
| 最大执行时间 | 30s（免费）/ 60s（Pro） | 10s（默认）/ 60s（Pro）/ 300s（Enterprise） |
| 网络稳定性 | 边缘节点，全球分布 | 集中式，受区域网络影响 |
| Node.js API | 不支持（无 fs、crypto 等） | 完整支持 |
| 适合场景 | AI 流式响应、API 代理、短请求 | 长耗时任务、需要 Node.js API 的场景 |

AI 对话场景选择 Edge Runtime 的原因：

- DashScope 国内节点到 Vercel Serverless（AWS）的网络出口不稳定，偶发 10-20s 超时
- Edge Runtime 的边缘节点（如 `hkg1` 香港）到国内网络更稳定
- SSE 流式响应需要长连接，Edge Runtime 的冷启动更快

但 RAG 相关路由因为依赖 `convex` 和 `@langchain`（使用 Node.js API），仍需保留在 Serverless Runtime。

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实调试经历撰写——一个 AI 原生的个人版 Notion，采用 pnpm workspace Monorepo 架构，Web + Mobile 双端。欢迎 Star ⭐*
