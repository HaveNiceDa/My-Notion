# Fly.io 部署操作指南 — services/ai

## 1. 前置条件

| 工具 | 安装方式 | 验证命令 |
|---|---|---|
| Fly CLI | `curl -L https://fly.io/install.sh \| sh` | `fly version` |
| Docker | [Docker Desktop](https://www.docker.com/products/docker-desktop/) | `docker --version` |
| pnpm | 已有（monorepo 依赖） | `pnpm --version` |

登录 Fly.io：

```bash
fly auth login
# 浏览器会打开授权页面，完成即可
```

如果没有 Fly.io 账号，先执行：

```bash
fly auth signup
```

---

## 2. 创建 Fly 应用

在项目根目录执行：

```bash
fly apps create my-notion-ai
```

> 应用名全局唯一，如果 `my-notion-ai` 已被占用，换一个名字，后续 `fly.toml` 中的 `app` 字段要保持一致。

记下输出的应用名，后续步骤会用到。

---

## 3. 创建配置文件

### 3.1 fly.toml

在 `services/ai/` 目录下创建：

```toml
app = "my-notion-ai"
primary_region = "sin"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

[http_service.concurrency]
  type = "connections"
  hard_limit = 100
  soft_limit = 80

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
```

**配置说明：**

| 字段 | 值 | 说明 |
|---|---|---|
| `primary_region` | `sin` | 新加坡，到 DashScope（阿里云国内）链路最优 |
| `internal_port` | `3001` | 与 `.env` 中的 `PORT` 一致 |
| `auto_stop_machines` | `stop` | 无流量时停止机器（省钱），有请求时自动拉起 |
| `min_machines_running` | `1` | 至少保留 1 台实例，避免冷启动延迟 |
| `memory` | `512mb` | AI 服务需要加载 openai/langchain 等重依赖，256mb 可能 OOM |

> **注意**：`min_machines_running = 1` 意味着始终有 1 台机器运行（约 $1.94/月）。如果可以接受冷启动延迟（约 3-5 秒），可以改为 `0` 来进一步节省费用。

### 3.2 Dockerfile

在 `services/ai/` 目录下创建：

```dockerfile
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.28.1 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ai/package.json packages/ai/
COPY services/ai/package.json services/ai/
RUN pnpm install --frozen-lockfile --prod

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/services/ai/node_modules ./services/ai/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/ai ./packages/ai
COPY services/ai ./services/ai
RUN pnpm --filter @notion/ai-service build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/dist/services/ai ./dist/services/ai
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/services/ai/node_modules ./services/ai/node_modules

EXPOSE 3001
CMD ["node", "dist/services/ai/src/server.js"]
```

**构建阶段说明：**

| 阶段 | 作用 |
|---|---|
| `deps` | 只复制 package.json 和 lockfile，安装依赖（利用 Docker 缓存） |
| `build` | 复制源码，执行 TypeScript 编译 |
| `runner` | 最终镜像，只包含编译产物和运行时依赖 |

### 3.3 .dockerignore

在 `services/ai/` 目录下创建：

```
node_modules
dist
.env
.env.local
.git
```

> **重要**：Docker 构建上下文是**项目根目录**（因为需要包含 `packages/ai`），所以 `.dockerignore` 也应该放在项目根目录。但为了不污染根目录，我们在部署命令中指定构建上下文。

实际上，由于 Dockerfile 需要访问 `packages/ai`，构建上下文必须是项目根目录。因此在**项目根目录**创建或更新 `.dockerignore`：

```
.git
apps/web/.next
apps/mobile
**/node_modules/.cache
**/.env.local
```

---

## 4. 设置环境变量（Secrets）

Fly.io 使用 Secrets 管理敏感环境变量，加密存储，不写入镜像：

```bash
fly secrets set \
  LLM_API_KEY=sk-69c8bba23c1b4226b11d3d00c14a6f79 \
  NEXT_PUBLIC_CONVEX_URL=https://handsome-stoat-500.convex.cloud \
  NEXT_PUBLIC_QDRANT_URL=https://a2fb3513-7234-4019-bf3e-c210e9920d4d.us-east4-0.gcp.cloud.qdrant.io \
  NEXT_PUBLIC_QDRANT_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0._0VZy118P2yJR3w9yBXgZh56ChoCYpJ-6Dp6uNDqtF0 \
  SERPAPI_API_KEY=e810a3496867241555f4d228e0d18727291f23ccafc0417b7cb6ddbcbf5fb004 \
  PORT=3001
```

> 如果后续需要添加 Sentry，额外设置：
> ```bash
> fly secrets set SENTRY_AI_SERVICE_DSN=your_sentry_dsn
> ```

验证 Secrets 是否设置成功：

```bash
fly secrets list
```

---

## 5. 部署

**在项目根目录执行**（不是 `services/ai/` 目录）：

```bash
fly deploy --config services/ai/fly.toml
```

首次部署会：
1. 构建 Docker 镜像（约 2-3 分钟）
2. 推送到 Fly.io 的镜像仓库
3. 在 `sin` 区域启动 VM
4. 分配公网 URL：`https://my-notion-ai.fly.dev`

---

## 6. 验证部署

### 6.1 健康检查

```bash
curl https://my-notion-ai.fly.dev/api/health
# 期望: {"status":"ok"}
```

### 6.2 AI 对话测试

```bash
curl -s -N -X POST https://my-notion-ai.fly.dev/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好，请用一句话介绍自己"}],"model":"qwen-plus"}' \
  --max-time 30
```

期望：SSE 流式返回，首包在 2 秒内到达。

### 6.3 查看日志

```bash
fly logs
```

实时查看服务日志，确认阶段日志正常输出。

### 6.4 检查 VM 状态

```bash
fly machines list
fly status
```

---

## 7. 更新 Mobile 端环境变量

部署成功后，更新 Mobile 端的 AI 服务地址：

在 `apps/mobile/.env.production` 中：

```
EXPO_PUBLIC_AI_SERVICE_URL=https://my-notion-ai.fly.dev
```

在 `apps/mobile/.env.local` 中（开发环境也可以指向 Fly）：

```
EXPO_PUBLIC_AI_SERVICE_URL=https://my-notion-ai.fly.dev
```

> 如果开发环境仍想用本地服务，保持 `EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:3001`。

---

## 8. 自定义域名（可选）

如果不想用 `my-notion-ai.fly.dev`，可以绑定自定义域名：

```bash
fly certs add ai.your-domain.com
```

然后按照输出的 DNS 验证信息，在你的域名 DNS 管理中添加 CNAME 记录：

```
ai.your-domain.com  CNAME  my-notion-ai.fly.dev
```

验证证书：

```bash
fly certs check ai.your-domain.com
```

---

## 9. 日常运维

### 查看实时日志

```bash
fly logs
```

### SSH 进入机器

```bash
fly ssh console
# 进入后可以检查文件系统、环境变量等
```

### 扩容（多区域部署）

如果需要覆盖更多区域：

```bash
fly machines clone --region hkg  # 克隆到香港
fly machines clone --region nrt  # 克隆到东京
```

### 更新部署

代码变更后，重新执行：

```bash
fly deploy --config services/ai/fly.toml
```

### 回滚

```bash
fly releases          # 查看历史版本
fly rollback <version>  # 回滚到指定版本
```

---

## 10. 费用预估

| 资源 | 配置 | 月费用 |
|---|---|---|
| VM (shared-cpu-1x, 512mb) | 1 台常驻 | ~$1.94 |
| 带宽 | 前 160GB 免费 | $0 |
| **合计** | | **~$1.94/月** |

> Fly.io 免费额度包含：3 台 shared-cpu-1x VM（256mb）、160GB 带宽。512mb 超出免费额度，需付费。

---

## 11. 常见问题

### Q: 部署报错 `failed to fetch an image or build from source`

确认 Docker 构建上下文是项目根目录，`fly deploy` 命令必须在项目根目录执行。

### Q: 部署成功但 `/api/health` 返回 502

检查 VM 是否正常启动：

```bash
fly machines list
fly logs
```

常见原因：
- `PORT` 环境变量未设置或与 `fly.toml` 中 `internal_port` 不一致
- 构建产物路径不对，`CMD` 启动失败

### Q: `/api/chat` 仍然超时

1. 检查 Fly VM 是否在 `sin` 区域：`fly machines list`
2. 检查 Secrets 是否完整：`fly secrets list`
3. 查看日志中 `first_event_received` 阶段是否到达
4. 如果 VM 在 `sin` 但仍超时，可能是 DashScope 本身的问题，尝试换模型测试

### Q: 冷启动延迟高

`min_machines_running = 1` 可以避免冷启动。如果设为 `0`，首次请求会有 3-5 秒延迟。

### Q: 如何清理 Vercel 上的旧部署

确认 Fly.io 部署稳定后，可以在 Vercel Dashboard 中删除 `services/ai` 对应的项目，或在项目根目录执行：

```bash
vercel --prod --yes  # 不再部署 services/ai
```

更推荐直接在 Vercel Dashboard 中移除该项目的 Git 集成。
