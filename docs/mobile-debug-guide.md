# Mobile 端构建与调试问题排查手册

## 一、环境变量

### 问题：`.env.local` 覆盖 `.env`

Expo env 加载优先级：`.env.local` > `.env.production` > `.env`

本地开发时 `.env.local` 里的线上地址覆盖了 `.env` 的本地地址，导致 AI 请求始终走线上。

**修复**：删除 `.env.local`，本地开发只用 `.env`。

### 问题：`.env.production` 在 `--no-dev` 模式下覆盖 `.env`

`npx expo start --no-dev --minify` 会设置 `NODE_ENV=production`，Expo 优先读 `.env.production`。

**修复**：删除 `.env.production`，生产构建的环境变量统一由 `eas.json` 管理。

### 问题：`localhost` 在真机上指向手机自身

`.env` 里 `EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:3001`，真机上 `localhost` 解析为手机自身，请求打不到开发机。

**修复**：改为局域网 IP `http://192.168.101.57:3001`。注意换 Wi-Fi 后 IP 可能变化。

### 问题：EAS Build 不读 `.env`

`.env` 在 `.gitignore` 中，EAS 云端构建时无法读取。`EXPO_PUBLIC_` 变量必须在 `eas.json` 的 `env` 字段中显式声明。

**修复**：在 `eas.json` 三个 profile（development / preview / production）中都配置了 `EXPO_PUBLIC_CONVEX_URL`、`EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`、`EXPO_PUBLIC_AI_SERVICE_URL`。

### 环境变量管理规范

| 文件 | 用途 | AI 地址 |
|---|---|---|
| `.env` | 本地开发 | `http://<局域网IP>:3001` |
| `eas.json` env | EAS Build | `https://my-notion-ai.vercel.app` |
| Vercel Dashboard | services/ai 部署 | `LLM_API_KEY` 等服务端变量 |

---

## 二、路由与导航

### 问题：`app/index.tsx` 的 `<Redirect>` 导致 "navigate before mounting" 崩溃

expo-router v6 中，`<Redirect href="./(home)" />` 在 Stack navigator 挂载完成前触发导航，导致运行时崩溃。Web 端容错较好不报错，原生端直接白屏。

**修复**：删除 `app/index.tsx`，在根 `_layout.tsx` 的 `<Stack>` 上使用 `initialRouteName="(home)"` 直接指定初始路由。

```tsx
// app/_layout.tsx
<Stack initialRouteName="(home)">
  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
  <Stack.Screen name="(home)" options={{ headerShown: false }} />
</Stack>
```

### 问题：`app/src/` 目录导致路由冲突

expo-router 将 `app/` 目录下的所有文件视为路由。`app/src/i18n/` 等非路由目录被解析为路由，产生 "conflicting screens with the same pattern" 错误。

**修复**：将 `app/src/` 整体迁移到项目根目录 `src/`，更新 `tsconfig.json` 的 `@/*` 路径映射。

### 问题：`useAuth()` 未加载时返回 `null` 导致空白

`(home)/_layout.tsx` 和 `(auth)/_layout.tsx` 中 `!isLoaded` 时返回 `null`，页面完全空白无反馈。

**修复**：改为显示 ActivityIndicator 加载指示器。

---

## 三、构建与打包

### EAS Build 命令

```bash
# 预览 APK（直接安装测试）
eas build --platform android --profile preview

# 生产 AAB（上架 Google Play）
eas build --platform android --profile production
```

### 本地模拟生产模式

```bash
# 快速验证（不需要真正打包）
npx expo start --no-dev --minify

# 清除缓存后启动
npx expo start --clear --no-dev --minify
```

### Metro 缓存问题

`EXPO_PUBLIC_` 变量在 bundle 时被内联替换，旧 bundle 可能缓存在 Metro 中。修改 `.env` 后必须清缓存：

```bash
rm -rf .expo node_modules/.cache/metro
npx expo start --clear
```

### `package.json` 脚本冲突

`convex` 脚本名与 `convex` 包冲突，`expo doctor` 会报错。改为带前缀的命名：

```json
{
  "dev": "expo start",
  "dev:convex": "npx convex dev --typecheck=disable",
  "dev:all": "concurrently \"pnpm run dev\" \"pnpm run dev:convex\""
}
```

### React Compiler 导致生产构建白屏

`app.json` 中 `"reactCompiler": true` 实验性功能可能导致 Context Provider 失效或 Redirect 不跳转。

**修复**：从 `experiments` 中移除 `reactCompiler`。

---

## 四、真机调试

### Expo Go vs Development Build

- **Expo Go**：扫码即用，但部分原生插件（如 Clerk）可能不完全兼容
- **Development Build**：需要先构建，但支持所有原生插件

如果 Expo Go 扫码后 Clerk 认证异常，需要切换到 Development Build。

### 真机查看 Vercel 日志

1. **Vercel Dashboard**：项目 → Logs 标签页，实时查看
2. **Vercel CLI**：`vercel logs --follow`（需先 `vercel login`）

### Error Boundary

生产模式下错误被静默吞掉。在根 Layout 外层包裹 `RootErrorBoundary`，崩溃时显示错误信息：

```tsx
<RootErrorBoundary>
  <SafeAreaProvider>
    <ClerkProvider>...</ClerkProvider>
  </SafeAreaProvider>
</RootErrorBoundary>
```

---

## 五、SSE 流式响应

### 问题：React Native 原生端 `ReadableStream` 不兼容

Web 端 `response.body.getReader()` 正常工作，但 React Native 原生端对 `ReadableStream` 支持不完整，导致 SSE 流读取卡住，真机 AI 请求一直转圈。

**修复**：按平台分流，Web 端用 `ReadableStream` 流式读取，原生端用 `response.text()` 一次性读取：

```tsx
if (Platform.OS === "web") {
  // ReadableStream 流式解析
  const reader = response.body?.getReader();
  // ...
} else {
  // 原生端一次性读取
  const text = await response.text();
  processSSEBuffer(text + "\n", callbacks);
}
```

### services/ai 的 Edge Runtime 问题

`api/chat.ts` 使用 Hono 格式（`export default app`）+ `export const runtime = "edge"`，但 Vercel 将其识别为 Serverless 函数，和 catch-all `api/[[...route]].js` 冲突。

当前状态：`/api/chat` 走 Serverless Runtime，DashScope 调用偶尔超时。Web 端有自己的 Edge 版 `/api/chat`（Next.js Route Handler），不受影响。Mobile 端直接请求 `services/ai`，受 Serverless 网络不稳定影响。

**待解决**：需要将 `api/chat.ts` 改为 Vercel 原生 Edge Function 格式（`export async function POST`），同时修复 `tsconfig.json` 的 `lib` 配置（加 `"WebWorker"`）和 `include` 配置（加 `"api/**/*"`）。

---

## 六、关键文件清单

| 文件 | 作用 |
|---|---|
| `apps/mobile/.env` | 本地开发环境变量 |
| `apps/mobile/eas.json` | EAS Build 配置（含环境变量） |
| `apps/mobile/app/_layout.tsx` | 根布局（Provider 栈 + Stack） |
| `apps/mobile/app/(home)/_layout.tsx` | 首页布局（Clerk 认证守卫） |
| `apps/mobile/app/(auth)/_layout.tsx` | 认证布局（已登录重定向） |
| `apps/mobile/src/lib/ai/chat.ts` | AI 请求（SSE 流解析，平台分流） |
| `apps/mobile/src/components/root-error-boundary.tsx` | 生产模式错误捕获 |
| `services/ai/api/chat.ts` | AI 服务 Edge 入口（Hono 格式） |
| `services/ai/api/[[...route]].js` | AI 服务 Serverless catch-all |
