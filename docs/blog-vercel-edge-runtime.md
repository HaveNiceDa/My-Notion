# Vercel Serverless 调国内 AI 接口 504？Edge Runtime 救了你

> Mobile 端 AI 对话请求在 Vercel 上稳定 504 超时，本地却秒回。CORS 报错是假的，区域配置也没用。最终发现是 Vercel Serverless（AWS Lambda）到国内 DashScope 的网络出口根本不通。一行 `export const runtime = "edge"` 切到 Cloudflare 边缘网络，3 秒完成。这篇文章把排查过程、根因分析和解决方案一次性讲清楚。

## 0. 前景提要：项目架构与问题背景

先交代项目架构，方便理解后续为什么 Web 端和 Mobile 端表现不同。

### 项目结构

```
My-Notion/                    # pnpm workspace Monorepo
├── apps/
│   ├── web/                  # Web 端（Next.js）
│   └── mobile/               # Mobile 端（Expo / React Native）
├── packages/
│   └── ai/                   # AI 核心逻辑（共享包）
│       ├── server/           #   streamChat、streamRAG、ConvexDataSource...
│       ├── config/           #   模型配置、Base URL
│       ├── tools/            #   WebSearch 等工具
│       └── rag/              #   向量检索逻辑
└── services/
    └── ai/                   # AI 网关（Hono），独立部署到 Vercel
        ├── api/              #   Vercel Serverless / Edge 入口
        └── src/              #   路由、Convex 数据源、Sentry
```

### 为什么 Mobile 不直接用 Web 端的 API

Web 端的 AI 路由（`/api/chat`、`/api/rag-stream`）是 Next.js API Route，跑在 `apps/web` 这个 Vercel 项目里。Mobile 端不能直接调这些路由，原因有三个：

1. **SSE 流式传输**：Mobile 端需要 Server-Sent Events 格式的流式响应，Web 端的 `/api/chat` 用的是 NDJSON 格式，不兼容
2. **密钥隔离**：AI 服务的 `LLM_API_KEY` 不应该暴露在 Mobile 客户端，需要一个中间层代理
3. **独立扩缩**：AI 请求是重 IO 操作，和 Web 页面服务混在一起会互相影响

所以 Mobile 端的 AI 请求走独立部署的 `services/ai`（基于 Hono 的轻量 Node.js 服务），部署在 `my-notion-ai.vercel.app`。

### 两条 AI 链路

```
Web 端：
  浏览器 → apps/web (Next.js API Route) → DashScope
           ↑ 同一个 Vercel 项目，Serverless Function

Mobile 端：
  App → services/ai (Hono) → DashScope
        ↑ 独立 Vercel 项目，Serverless Function
```

**关键点**：两条链路都跑在 Vercel Serverless（AWS Lambda）上，但它们是不同的 Vercel 项目，函数冷启动、预热策略、网络出口可能不同。这解释了为什么"Web 端偶尔慢，Mobile 端必超时"。

### DashScope 是什么

DashScope 是阿里云的大模型服务平台，提供 OpenAI 兼容接口。项目用的模型是通义千问（Qwen），Base URL 是 `https://dashscope.aliyuncs.com/compatible-mode/v1`——这是一个**国内节点**。

这就是问题的伏笔：**Vercel 的服务器在海外，DashScope 的服务在国内，中间隔着一条不稳定的网络链路。**

## 1. 开篇：文档正常，AI 炸了

项目是 Web + Mobile 双端架构，共享 `packages/ai` 核心逻辑。Mobile 端的 AI 请求走独立部署的 `services/ai`（Hono），域名是 `my-notion-ai.vercel.app`。

上线后发现问题：

- Mobile 文档功能（Convex）**完全正常**
- Mobile AI 对话请求**长期 pending**，最终 504
- Web 端 AI 功能**偶尔也慢**

浏览器网络面板显示的是 CORS 错误，但 `OPTIONS /api/chat` 返回 `204`，预检请求没问题。真正挂的是 `POST /api/chat`。

**CORS 报错是服务器 500/504 后的表象，不是根因。浏览器只在请求失败时才告诉你"可能是 CORS"，实际上后端已经炸了。**

## 2. 排查：五层剥洋葱

### 2.1 第一层：前端代码

检查 Mobile 端的请求逻辑——URL 正确、Header 正确、Body 格式正确。没有根本性错误。

**结论：问题不在 Mobile 前端。**

### 2.2 第二层：CORS

`OPTIONS /api/chat` 返回 `204`，`GET /api/health` 返回 `{"status":"ok"}`。CORS 中间件 `app.use("*", cors())` 全局开启，配置正确。

**结论：CORS 不是根因，只是请求失败的表层表现。**

### 2.3 第三层：路由与部署入口

最初 `/api/health` 返回 404，经过以下修复后恢复正常：

- 调整 Hono 路由前缀
- 修正 Vercel catch-all API 入口
- 清理错误的 `vercel.json` 重写规则

**结论：路由问题已修复，但 AI 请求仍然超时。**

### 2.4 第四层：模块加载

Vercel 尝试以 CJS 模式加载 ESM 产物，以及无法解析 `workspace:*` 依赖中的 `.ts` 源码。修复方式：

- 创建 CJS 包装器 `api/[[...route]].js` 加载 `dist/` 产物
- 本地化 `ConvexDataSource` 逻辑，消除运行时对 workspace 源码的依赖

修复后 `/api/health` 稳定返回 200。

**结论：模块加载问题已修复，但 `POST /api/chat` 仍然超时。**

### 2.5 第五层：网络出口——真正的根因

在 `/api/chat` 路由中增加了分阶段日志和首包超时保护：

```typescript
const CHAT_FIRST_EVENT_TIMEOUT_MS = 20_000;

const firstEventTimer = setTimeout(() => {
  if (!didReceiveFirstEvent) {
    didTimeoutBeforeFirstEvent = true;
    abortController.abort();
  }
}, CHAT_FIRST_EVENT_TIMEOUT_MS);
```

Vercel Runtime Logs 显示：

- `request_received` ✅ 打出了
- `model_request_started` ✅ 打出了
- `first_event_received` ❌ 始终没出

请求进入了服务，也发起了对 DashScope 的调用，但**首包永远收不到**。300 秒后 Vercel 强制超时，返回 `504 FUNCTION_INVOCATION_TIMEOUT`。

**结论：Vercel Serverless 到 DashScope 的网络出口链路不稳定，请求卡在等待上游响应阶段。**

## 3. 验证：本地秒回，线上卡死

本地启动 `services/ai`，测试 `/api/chat`：

```bash
curl -s -N -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}],"model":"qwen-plus"}' \
  --max-time 30
```

服务端日志：

```
[services/ai][chat][xxx] request_received
[services/ai][chat][xxx] model_request_started
[services/ai][chat][xxx] first_event_received  {"elapsedMs":657}    ← 657ms 首包
[services/ai][chat][xxx] stream_completed      {"elapsedMs":1714}   ← 1.7s 完成
```

本地 1.7 秒完成，首包 657ms。DashScope 服务本身完全正常。

**100% 确认：问题在 Vercel 运行环境到 DashScope 的网络链路，不在代码。**

## 4. 尝试修复：换区域，没用

Vercel 默认把函数跑在美东（iad1），到国内 DashScope 的链路确实很远。手动把 Function Region 改到香港（hkg1），确认配置生效后重新测试。

结果：**仍然 504 超时。**

区域确实有影响，但不是唯一根因。Vercel 的 Serverless Function 跑在 AWS Lambda 上，即使入口区域是 hkg1，网络出口的路由仍然可能绕远或不稳定。你无法控制 AWS 内部的流量调度。

## 5. 尝试修复：换 DashScope Endpoint，Key 不通用

DashScope 提供三个区域的 OpenAI 兼容接口：

| 区域 | Base URL |
|---|---|
| 北京（国内） | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 弗吉尼亚（美国） | `https://dashscope-us.aliyuncs.com/compatible-mode/v1` |
| 新加坡（国际） | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1` |

心想换成新加坡国际站 endpoint，从 Vercel 到新加坡应该更通。结果：

```
401 Incorrect API key provided
```

**国内站和国际站的 API Key 完全隔离，互不通用。** 你的 Key 是国内站申请的，只能用国内站 endpoint。要用国际站，得重新注册阿里云国际站账号、开通百炼、申请新 Key。

## 6. 最终方案：Edge Runtime

### 6.1 关键洞察

Vercel 上有两种运行代码的方式，它们跑在**完全不同的基础设施**上：

| | Serverless Function | Edge Function |
|---|---|---|
| 底层 | AWS Lambda | Cloudflare Workers |
| 运行时 | 完整 Node.js | V8 引擎（浏览器级） |
| 冷启动 | 500ms ~ 几秒 | < 5ms |
| 网络出口 | AWS 区域内网 | Cloudflare 边缘网络 |
| 超时限制 | 10~300 秒 | 30 秒 |

**Serverless 走 AWS 的网络出口到 DashScope 不通，不代表 Edge 走 Cloudflare 的网络出口也不通。** 这是两条完全不同的网络路径。

### 6.2 实操：一行声明切换

在 `services/ai/api/chat.ts` 中创建 Edge 版入口：

```typescript
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import OpenAI from "openai";

export const runtime = "edge";        // 关键：声明为 Edge Runtime
export const preferredRegion = "hkg1"; // 优先在香港执行

const app = new Hono().basePath("/api");
app.use("*", cors());

app.post("/chat", async (c) => {
  const openai = new OpenAI({
    apiKey: process.env.LLM_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  });

  return streamSSE(c, async (stream) => {
    const response = await openai.chat.completions.create({
      model: "qwen-plus",
      messages: [...],
      stream: true,
    });

    for await (const chunk of response) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        stream.writeSSE({ event: "content", data: JSON.stringify({ type: "content", text }) });
      }
    }
    stream.writeSSE({ event: "done", data: JSON.stringify({ type: "done" }) });
  });
});

export default app;
```

Vercel 的路由规则中，具体路径（`api/chat.ts`）优先于 catch-all（`api/[[...route]].js`），所以 `/api/chat` 走 Edge，其他路由继续走 Serverless。

### 6.3 结果

```bash
curl -s -N -X POST https://my-notion-ai.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"请用中文详细解释什么是向量数据库，至少200字"}],"model":"qwen-plus"}' \
  --max-time 30 -w '\nHTTP_CODE: %{http_code}\nTIME_TOTAL: %{time_total}s\n'
```

```
HTTP_CODE: 200
TIME_TOTAL: 3.658670s
```

**从 300 秒超时到 3.66 秒完成。问题彻底解决。**

## 7. 为什么 Web 端"偶尔慢"

Web 端的 AI 路由也跑在 Vercel Serverless 上，用的是同一个 AWS 网络出口。那为什么 Web 端只是"偶尔慢"而不是"必超时"？

原因有两个：

1. **Web 端是 Next.js 项目**，Vercel 对 Next.js 有更好的优化（函数预热、增量静态生成），冷启动更快
2. **偶尔慢 = 同一根因**，只是因为 Next.js 的优化偶尔让请求抢在超时前完成

把 Web 端的 `/api/chat` 和 `/api/editor-ai/streamText` 也迁移到 Edge Runtime 后，稳定性进一步提升。

## 8. Edge Runtime 的限制

Edge 不是万能的。它的核心限制是**只能用 Web 标准 API**：

| 可用 | 不可用 |
|---|---|
| `fetch`、`Request`、`Response` | `fs`（文件系统） |
| `ReadableStream` | `require()`（只能用 `import`） |
| `crypto.randomUUID()` | Node.js `crypto.createHash()` |
| `setTimeout` | `http`/`net` 模块 |
| `openai` SDK | `convex` SDK |
| `ai` (Vercel AI SDK) | `@langchain/core` |
| `@clerk/nextjs/server` | `serpapi` |

所以 `/api/rag-stream` 和 `/api/rag-complete` **不能**跑在 Edge 上——它们依赖 `convex` 和 `@langchain`，内部用了 Node.js API。

### 桶导出陷阱

即使你的路由只用 `streamChat`，但如果通过桶导出 import：

```typescript
import { streamChat } from "@notion/ai/server";
```

整个 `server/index.ts` 会被加载，包括 `streamRAG`（依赖 `@langchain`）和 `ConvexDataSource`（依赖 `convex`）。**Edge 环境下，import 阶段就会报错，不管你调不调用。**

解决方案：**内联 OpenAI 调用，不走桶导出**。这就是为什么 Edge 版的 `/api/chat` 直接用 `openai` SDK，而不是 `import { streamChat } from "@notion/ai/server"`。

## 9. DashScope Base URL 也做了可配置化

顺便做了一个小改进——把 DashScope 的 Base URL 改为环境变量可配置：

```typescript
// packages/ai/config/baseurl.ts
export const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";
```

这样如果后续注册了国际站 Key，只需设置环境变量 `DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1`，不用改代码。

## 10. 总结：Serverless 调国内 API 的排查清单

如果你的 Vercel Serverless Function 调国内服务（DashScope、通义千问、文心一言等）遇到超时，按这个清单排查：

| 步骤 | 检查项 | 方法 |
|---|---|---|
| 1 | 前端代码是否正确 | 本地 curl 直接测后端 API |
| 2 | CORS 是否配置 | 检查 OPTIONS 请求是否返回 204 |
| 3 | 路由是否挂载 | 检查 health 接口是否正常 |
| 4 | 模块是否加载成功 | 检查 Vercel Runtime Logs 有无启动错误 |
| 5 | **上游是否可达** | 加分阶段日志，确认首包是否收到 |
| 6 | 本地是否正常 | 本地跑同一条链路对比 |
| 7 | **换 Edge Runtime** | `export const runtime = "edge"` |

核心经验：

- **浏览器 CORS 报错 ≠ CORS 问题**，大概率是后端 500/504
- **Vercel Serverless 和 Edge 走不同的网络出口**，一个不通不代表另一个也不通
- **分阶段日志是排查超时问题的利器**——没有日志，你只能猜
- **Edge Runtime 不是银弹**，依赖 Node.js API 的路由不能迁移
- **桶导出会把不兼容的代码拉进 Edge 环境**，需要内联或拆分入口

一行 `export const runtime = "edge"`，省了迁移服务器、注册国际站、改 DNS 的全部成本。

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实踩坑经历撰写——一个 AI 原生的个人版 Notion，Web + Mobile 双端架构，AI 服务部署在 Vercel 上。欢迎 Star ⭐*
