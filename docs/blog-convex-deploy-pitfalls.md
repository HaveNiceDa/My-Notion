# Convex + Next.js + Clerk 上线求生指南：六个坑，一个比一个离谱

> "It works on my machine"——本地开发一切丝滑，推到线上直接爆炸。这不是运气差，而是 Convex + Clerk + Vercel 这套组合的"本地能跑 ≠ 线上能跑"属性太强了。这篇文章记录了 My-Notion 项目从本地开发到生产部署过程中踩过的六个坑，每一个都是真实报错、真实排查、真实修复。

## 1. 开篇：本地能跑，线上全炸

某天我信心满满地把代码推到 Vercel，打开生产域名，迎接我的是一连串红色报错：

```
[CONVEX Q(aiChat:getConversations)] Server Error
POST /api/rag-documents 500 Internal Server Error
Convex Server Error (auth)
```

本地 `pnpm dev` 跑得好好的，怎么一上线就全炸了？

冷静下来逐个排查，发现问题出在六个完全不同的层面——从 Convex 部署、React Hook 生命周期、Clerk JWT 域名、到 Qdrant 网络可达性、E2E 测试引用、i18n 路由前缀。每一个都是"本地不暴露，线上必炸"的典型。

下面逐个拆解。

## 2. 坑一：Convex 生产部署是空的

### 现象

打开线上页面，控制台疯狂报错：

```
[CONVEX Q(aiChat:getConversations)] Server Error
[CONVEX Q(documents:getDocuments)] Server Error
```

所有 Convex 查询全部失败。但本地开发环境完全正常。

### 排查

第一反应是 Vercel 的环境变量配错了。打开 Vercel Dashboard，检查 `NEXT_PUBLIC_CONVEX_URL`——指向的是 `https://xxx.convex.cloud`，这是 Convex 的生产部署 URL，没问题。

问题出在：**URL 指向了生产部署，但生产部署里什么都没有。**

`npx convex dev` 只会更新开发部署（dev deployment），不会推送任何东西到生产部署。我的 schema、functions、auth 配置全都只存在于 dev 环境，prod 环境是一个空壳。

### 修复

```bash
# 显式部署到生产环境
CONVEX_DEPLOYMENT=prod:your-deployment-name npx convex deploy
```

### 关键认知

| 命令 | 目标部署 | 用途 |
|------|----------|------|
| `npx convex dev` | dev | 本地开发，自动推送 schema 和 functions |
| `CONVEX_DEPLOYMENT=prod:xxx npx convex deploy` | prod | 生产部署，需要显式执行 |

⚠️ **注意**：Convex 新版 CLI 已经移除了 `--prod` flag，必须通过 `CONVEX_DEPLOYMENT` 环境变量指定目标部署。如果你还在用 `npx convex deploy --prod`，会直接报错。

```bash
# ❌ 旧写法（已废弃）
npx convex deploy --prod

# ✅ 新写法
CONVEX_DEPLOYMENT=prod:your-deployment-name npx convex deploy
```

**教训：`npx convex dev` ≠ `npx convex deploy`。开发环境自动同步，生产环境需要你手动推。上线前一定要确认 prod 部署里有东西。**

## 3. 坑二：页面加载就触发 Convex 查询——AI 面板关着也报错

### 现象

线上页面一加载，控制台就出现 Convex 查询错误，即使 AI 面板根本没有打开。每次路由切换都会触发，非常烦人。

### 排查

看 `useAIChat` 的代码：

```typescript
// apps/web/src/components/ai-chat/useAIChat.ts
export function useAIChat() {
  const { user } = useUser();
  const panelOpen = useAIChatStore((state) => state.panelOpen);
  const persistence = useAIChatPersistence();

  // ... 状态定义 ...

  useEffect(() => {
    if (!user || !panelOpen) return;  // ← 有 panelOpen 守卫
    refreshConversations();
  }, [user, panelOpen, refreshConversations]);

  return { /* ... */ };
}
```

`useEffect` 里确实有 `!panelOpen` 守卫，逻辑没问题。但问题出在 **`useAIChat` 被调用时，`useAIChatPersistence` 内部可能已经发起了 Convex 查询**。

React 的规则是：**Hooks 必须在条件返回之前调用**。你不能这样写：

```typescript
// ❌ 违反 Hook 规则
if (!panelOpen) return null;
const persistence = useAIChatPersistence(); // Hook 在条件之后调用
```

所以 `useAIChat` 必须无条件调用所有内部 Hook，但 `useEffect` 的依赖数组里如果没有 `panelOpen`，就会在每次 mount 时都执行查询。

### 修复

确保 `useEffect` 的依赖数组包含 `panelOpen`，并在回调中做守卫：

```typescript
useEffect(() => {
  if (!user || !panelOpen) return;
  refreshConversations();
}, [user, panelOpen, refreshConversations]);
```

这样当 `panelOpen` 为 `false` 时，effect 直接 return，不会发起任何 Convex 查询。

### 关键认知

| 写法 | 行为 | 是否正确 |
|------|------|----------|
| 依赖数组不含 `panelOpen` | 每次 mount 都查询 | ❌ |
| 依赖数组含 `panelOpen`，回调内守卫 | 面板关闭时不查询 | ✅ |
| 条件返回后再调 Hook | 违反 Hook 规则 | ❌ |

**教训：React Hook 的调用顺序规则决定了你不能"提前返回"来跳过 Hook。守卫逻辑必须放在 `useEffect` 内部，同时依赖数组要完整。**

## 4. 坑三：Clerk JWT 签发者域名不匹配

### 现象

用户登录后，所有需要认证的 Convex 请求都返回 Server Error。未登录状态下页面能加载，但一登录就炸。

### 排查

Convex 的认证配置在 `convex/auth.config.ts`：

```typescript
// apps/web/convex/auth.config.ts
import { AuthConfig } from "convex/server";

export default {
  providers: [
    {
      domain: "https://whole-badger-19.clerk.accounts.dev",  // ← Clerk 开发环境域名
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

问题找到了：`https://whole-badger-19.clerk.accounts.dev` 是 Clerk 的**开发环境**域名。生产环境中，Clerk 使用不同的域名签发 JWT（通常是 `https://your-app.clerk.accounts.dev` 或自定义域名）。

Convex 收到请求后，会用 `auth.config.ts` 中的 `domain` 去验证 JWT 的 `iss`（issuer）声明。域名不匹配 → 验证失败 → 认证失败 → Server Error。

### 修复

1. 登录 Clerk Dashboard，找到生产环境的 JWT 签发者域名
2. 更新 `auth.config.ts`：

```typescript
export default {
  providers: [
    {
      domain: "https://your-production-domain.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
```

3. **重新部署 Convex**（改了 `auth.config.ts` 必须重新 deploy 才生效）：

```bash
CONVEX_DEPLOYMENT=prod:your-deployment-name npx convex deploy
```

### 关键认知

Clerk 的开发环境和生产环境使用**不同的 JWT 签发者域名**：

| 环境 | JWT 签发者域名格式 |
|------|-------------------|
| 开发 | `https://xxx.clerk.accounts.dev` |
| 生产 | `https://yyy.clerk.accounts.dev`（或自定义域名） |

Convex 的 `auth.config.ts` 不会自动适配——你必须手动配置正确的域名。

**教训：Clerk 的 dev 和 prod 是完全隔离的，JWT 签发者域名不同。上线前必须检查 `auth.config.ts` 中的域名是否匹配生产环境，改完记得重新 deploy Convex。**

## 5. 坑四：Qdrant localhost 从 Vercel 访问不到

### 现象

线上调用 RAG 相关接口，返回 500：

```
POST /api/rag-documents 500 Internal Server Error
```

### 排查

检查 Vercel 的环境变量，发现：

```
NEXT_PUBLIC_QDRANT_URL=http://localhost:6333
```

本地开发时 Qdrant 跑在 Docker 里，`localhost:6333` 当然能访问。但 Vercel 的 Serverless Function 跑在 Vercel 的服务器上，它访问 `localhost:6333` 访问的是 Vercel 自己的机器——上面根本没跑 Qdrant。

### 修复

**第一步：部署 Qdrant Cloud**

在 [Qdrant Cloud](https://cloud.qdrant.io/) 创建集群，获取 URL 和 API Key。

**第二步：更新 Vercel 环境变量**

```
NEXT_PUBLIC_QDRANT_URL=https://your-cluster.qdrant.io
NEXT_PUBLIC_QDRANT_API_KEY=your-api-key
```

**第三步：添加优雅降级**

Qdrant 不可用时，不应该让整个 API 炸掉。RAG 只是增强功能，核心的文档编辑不应该受影响：

```typescript
// apps/web/src/app/api/rag-documents/route.ts
function isQdrantUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("QDRANT_URL") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("connect") ||
    msg.includes("timeout")
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "triggerDocumentUpdate": {
        try {
          await updateDocument({ userId, documentId: params.documentId, content: params.content, title: params.title });
        } catch (error) {
          if (isQdrantUnavailable(error)) {
            return NextResponse.json({
              success: true,
              warning: "Vector store unavailable — document not indexed",
            });
          }
          throw error;
        }
        return NextResponse.json({ success: true });
      }
      // ... 其他 case 同理 ...
    }
  } catch (error: unknown) {
    console.error("RAG Documents API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
```

关键设计：`isQdrantUnavailable` 检测到 Qdrant 不可达时，返回 `success: true` + `warning` 字段，而不是 500。前端可以展示警告，但不会阻断用户操作。

### 关键认知

| 场景 | Qdrant 状态 | API 响应 | 用户体验 |
|------|------------|----------|----------|
| 正常 | 可达 | `{ success: true }` | RAG 功能正常 |
| Qdrant 宕机 | 不可达 | `{ success: true, warning: "..." }` | 文档编辑正常，RAG 降级 |
| 其他错误 | 未知 | `{ success: false, error: "..." }` 500 | 报错 |

**教训：Serverless 环境下，`localhost` 永远指向 Serverless 容器自身，不是你的开发机。任何需要外部访问的服务，要么用云托管，要么确保网络可达。同时，非核心依赖一定要做优雅降级。**

## 6. 坑五：E2E 测试引用了已删除的 API 路由

### 现象

GitHub Actions CI 红了——Playwright E2E 测试全部失败。

### 排查

AI Agent 重构时，删除了一批旧的 API 路由：

| 已删除路由 | 替代路由 |
|-----------|---------|
| `/api/chat` | `/api/agent/stream` |
| `/api/rag-stream` | `/api/agent/stream` |
| `/api/rag-complete` | `/api/agent/stream` |
| `/api/embeddings` | `/api/rag-documents` |
| `/api/qdrant` | `/api/rag-documents` |

但 E2E 测试文件还在引用这些旧路由，请求直接 404。

### 修复

更新测试文件，使用新的 API 路由：

```typescript
// tests/web/api-routes.spec.ts（修复后）
test.describe("Web - API Routes", () => {
  test("rag-documents endpoint requires POST", async ({ page }) => {
    const response = await page.goto("/api/rag-documents");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });

  test("agent stream endpoint requires POST", async ({ page }) => {
    const response = await page.goto("/api/agent/stream");
    expect(response).toBeDefined();
    expect([401, 405, 400]).toContain(response!.status());
  });
});
```

```typescript
// tests/web/api-auth.spec.ts（修复后）
test("POST /api/rag-documents with initKnowledgeBaseVectorStore returns non-500", async ({ page }) => {
  await page.goto("/documents");
  await page.waitForLoadState("domcontentloaded");

  const { status, body } = await apiPost(page, "/api/rag-documents", {
    action: "initKnowledgeBaseVectorStore",
  });
  expect(status).toBeLessThan(500);
  expect(body).toHaveProperty("success");
});

test("POST /api/agent/stream with valid messages returns non-401", async ({ page }) => {
  await page.goto("/documents");
  await page.waitForLoadState("domcontentloaded");

  const status = await page.evaluate(async () => {
    const res = await fetch("/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "Hello" }],
        modelId: "deepseek-v4-pro",
      }),
    });
    res.body?.cancel();
    return res.status;
  });
  expect(status).not.toBe(401);
});
```

### 关键认知

重构 API 路由时的检查清单：

| 步骤 | 操作 | 容易遗漏 |
|------|------|----------|
| 1 | 更新前端调用代码 | ✅ 一般不会忘 |
| 2 | 删除旧路由文件 | ✅ 一般不会忘 |
| 3 | 更新 E2E 测试 | ❌ **经常忘** |
| 4 | 更新 API 文档 / README | ❌ **经常忘** |
| 5 | 检查外部调用方（Webhook 等） | ❌ **经常忘** |

**教训：删除 API 路由时，一定要全局搜索路由路径，确保测试、文档、外部调用方全部更新。CI 是你的安全网——本地跑测试通过不代表 CI 没问题，因为 CI 环境可能跑的是不同的测试配置。**

## 7. 坑六：i18n 语言切换出现双重语言前缀

### 现象

切换语言后，URL 变成了 `/zh-CN/zh-CN/documents`，直接 404。

### 排查

看语言切换组件的代码：

```typescript
// ❌ 错误写法
const toggleLanguage = () => {
  const newLocale = locale === "zh-CN" ? "en" : "zh-CN";
  // 手动替换 pathname 中的 locale 前缀
  const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`);
  // 又传了 locale 选项，next-intl 会再添加一次前缀
  router.push(newPathname, { locale: newLocale });
};
```

问题在于**做了两次 locale 替换**：

1. `pathname.replace(`/${locale}`, `/${newLocale}`)` → 手动把 `/zh-CN/documents` 变成 `/en/documents`
2. `router.push(newPathname, { locale: newLocale })` → next-intl 的 `locale` 选项会自动添加前缀，把 `/en/documents` 变成 `/en/en/documents`

如果当前是中文，切换到英文：
- `pathname` = `/zh-CN/documents`
- 手动替换后 = `/en/documents`
- next-intl 再加前缀 = `/en/en/documents` ← 炸了

反过来，英文切中文：
- `pathname` = `/en/documents`
- 手动替换后 = `/zh-CN/documents`
- next-intl 再加前缀 = `/zh-CN/zh-CN/documents` ← 也炸了

### 修复

```typescript
// apps/web/src/components/language-toggle.tsx（修复后）
export function LanguageToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useParams<{ locale: string }>();

  const toggleLanguage = () => {
    const newLocale = locale === "zh-CN" ? "en" : "zh-CN";
    // ✅ 只传 locale 选项，让 next-intl 自动处理前缀替换
    router.push(pathname, { locale: newLocale });
  };

  return (
    <Button variant="outline" size="icon" onClick={toggleLanguage}>
      {locale === "zh-CN" ? "中" : "EN"}
    </Button>
  );
}
```

关键：`router.push(pathname, { locale: newLocale })` 中的 `pathname` 仍然包含当前 locale 前缀（如 `/zh-CN/documents`），但 next-intl 的 `locale` 选项会**自动替换**前缀，不需要你手动处理。

### 关键认知

| 写法 | 行为 | 结果 |
|------|------|------|
| `router.push(pathname.replace(...), { locale })` | 手动替换 + next-intl 替换 | 双重前缀 ❌ |
| `router.push(pathname, { locale })` | 只让 next-intl 替换 | 正确 ✅ |
| `router.push(pathname.replace(...))` | 只手动替换，不传 locale | 可能正确但不推荐 |

**教训：next-intl 的 `locale` 选项已经包含了前缀替换逻辑，不要画蛇添足手动替换 pathname。框架的事让框架做。**

## 8. 环境变量清单

上线前，确保以下环境变量全部正确配置。少一个都可能炸：

| 变量名 | 必填 | 说明 | 常见坑 |
|--------|------|------|--------|
| `CONVEX_DEPLOYMENT` | ✅ | Convex 部署标识，格式 `prod:xxx` | 忘了配，deploy 推不到 prod |
| `NEXT_PUBLIC_CONVEX_URL` | ✅ | Convex 客户端连接 URL | 指向 dev 而非 prod |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | ✅ | Convex Site URL，用于 HTTP API | 忘了配，HTTP Action 调不通 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | ✅ | Clerk 前端 Publishable Key | dev/prod Key 不一致 |
| `CLERK_SECRET_KEY` | ✅ | Clerk 后端 Secret Key | dev/prod Key 不一致 |
| `CLERK_JWT_ISSUER_DOMAIN` | ⚠️ | Clerk JWT 签发者域名 | 不匹配 `auth.config.ts` 中的域名 |
| `EDGE_STORE_ACCESS_KEY` | ✅ | EdgeStore 访问密钥 | 图片上传失败 |
| `EDGE_STORE_SECRET_KEY` | ✅ | EdgeStore 密钥 | 图片上传失败 |
| `NEXT_PUBLIC_QDRANT_URL` | ⚠️ | Qdrant 地址 | 配了 `localhost`，线上不可达 |
| `NEXT_PUBLIC_QDRANT_API_KEY` | ⚠️ | Qdrant API Key | 本地 Docker 不需要，线上必须配 |
| `LLM_API_KEY` | ✅ | DashScope / OpenAI API Key | AI Chat 和 RAG 全部不可用 |
| `SENTRY_ORG` | ❌ | Sentry 组织 | 可选，不影响核心功能 |
| `SENTRY_PROJECT` | ❌ | Sentry 项目 | 可选 |
| `SENTRY_AUTH_TOKEN` | ❌ | Sentry 认证 Token | 可选 |

⚠️ 标记的变量缺失时，对应功能降级但不阻断核心流程（得益于 `isQdrantUnavailable` 等容错机制）。

**特别提醒**：`NEXT_PUBLIC_` 前缀的变量会暴露到客户端，**绝对不要把 Secret Key 放到 `NEXT_PUBLIC_` 变量里**。

## 9. 部署验证清单

上线后，按以下步骤逐一验证：

### 第一步：基础连通性

- [ ] 打开生产域名，页面能正常加载
- [ ] 注册 / 登录功能正常
- [ ] 登录后页面不出现 Convex Server Error

### 第二步：Convex 数据层

- [ ] 创建文档，检查是否出现在文档列表
- [ ] 编辑文档内容，检查是否实时保存
- [ ] 删除文档，检查是否移入回收站

### 第三步：认证与权限

- [ ] 未登录状态访问受保护页面，正确跳转登录
- [ ] 登录后 Convex 查询不报 auth 错误
- [ ] 检查 Clerk Dashboard，确认 JWT template 配置正确

### 第四步：AI 功能

- [ ] 打开 AI Chat 面板，能正常发送消息
- [ ] AI 回复正常流式输出
- [ ] RAG 知识库初始化不报 500（可能返回 warning，正常）
- [ ] 编辑器 AI 功能正常

### 第五步：i18n

- [ ] 语言切换后 URL 正确（无双重前缀）
- [ ] 切换后页面内容正确翻译
- [ ] 刷新页面后语言保持

### 第六步：CI/CD

- [ ] GitHub Actions 构建通过
- [ ] E2E 测试全部通过
- [ ] 无 TypeScript 编译错误

## 10. 总结

| 坑 | 根因 | 本地为什么没暴露 | 修复核心 |
|----|------|-----------------|----------|
| Convex prod 部署为空 | `npx convex dev` 只更新 dev | 本地连的就是 dev | `CONVEX_DEPLOYMENT=prod:xxx npx convex deploy` |
| AI 面板关闭仍查询 | useEffect 依赖不完整 | 本地 dev 部署有数据，查询不报错 | 依赖数组加 `panelOpen` |
| Clerk JWT 域名不匹配 | auth.config.ts 写了 dev 域名 | 本地用 dev Clerk，域名匹配 | 更新为 prod 域名 + 重新 deploy |
| Qdrant localhost 不可达 | Vercel 访问不到本地 Docker | 本地 Docker 正常运行 | Qdrant Cloud + 优雅降级 |
| E2E 测试引用旧路由 | 重构时忘了更新测试 | 本地可能没跑 E2E | 更新测试文件路由路径 |
| i18n 双重前缀 | 手动替换 + next-intl 自动替换 | 本地切换可能没注意 URL | 只用 `locale` 选项 |

**本地能跑 ≠ 线上能跑。** 这六个坑的共同特点是：本地开发环境恰好满足所有隐含条件（dev 部署有数据、localhost 可达、dev 域名匹配、测试没跑），所以问题被掩盖了。生产环境把这些条件全部撕开，问题才暴露。

核心教训有三条：

1. **显式优于隐式**——Convex 的 dev/prod 隔离、Clerk 的 dev/prod 域名、Qdrant 的 localhost/Cloud，都是隐式依赖本地环境。上线前要显式检查每一个。
2. **优雅降级不是可选的**——Qdrant 挂了不应该让整个应用 500。非核心依赖必须有 fallback。
3. **CI 是安全网**——E2E 测试、TypeScript 检查、lint，这些在 CI 里跑的东西，本地开发时也要定期跑。不要等 CI 红了才发现问题。

---

*本文基于 [My-Notion](https://github.com/HaveNiceDa/My-Notion) 项目的真实部署经历撰写——一个 AI 原生的个人版 Notion，Convex + Next.js + Clerk 全栈部署。欢迎 Star ⭐*
