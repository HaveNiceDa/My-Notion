# Mobile 调试手册

本手册保留当前仍有操作价值的 Mobile 调试规则。更长的历史排障复盘已压缩到 `blog-archive.md`。

## 环境变量

### `.env.local` 覆盖 `.env`

Expo env 加载优先级通常会让 `.env.local` 覆盖 `.env`。本地开发如果 `.env.local` 指向线上地址，会导致真机请求误走线上。

建议：本地开发只保留明确用途的 `.env`，生产/预览构建变量放到 `eas.json` 或 EAS secret。

### `.env.production` 覆盖本地配置

`npx expo start --no-dev --minify` 可能触发 production 环境变量加载。

建议：不要依赖本地 `.env.production` 做 EAS 生产配置，生产变量统一由 `eas.json` / EAS secret 管理。

### 真机不能访问 `localhost`

真机上的 `localhost` 指向手机自身，不是开发机。

建议：本地 AI 或 Web 服务调试时使用局域网 IP，例如 `http://192.168.x.x:3001`，并确认手机和电脑在同一网络。

## 路由与导航

### `<Redirect>` 过早触发导航

expo-router 中如果在 navigator 挂载前导航，原生端可能白屏。

建议：优先在根 `_layout.tsx` 的 Stack 上配置 `initialRouteName`，避免入口页立即重定向。

### `app/src` 被识别为路由

expo-router 会扫描 `app/` 下文件。业务源码不应放在 `app/src` 里。

建议：移动端业务源码放到 `apps/mobile/src` 或明确不被 router 扫描的位置，`app/` 只保留路由。

### Auth 未加载时空白

`useAuth()` 未加载完成时不要直接返回 `null`。

建议：显示 loading 状态，避免真机白屏无法判断是认证、路由还是渲染问题。

## AI 请求

### Web 可用但真机不可用

排查顺序：

1. 确认请求 URL 是局域网、本地服务还是线上服务。
2. 查看服务端是否有请求日志；无日志通常说明请求未到服务端或被平台路由拦截。
3. 检查 `.vercel.app` 等域名在当前网络下是否可访问。
4. Native 端不要假设 `ReadableStream` 行为和 Web 一致，必要时用 `response.text()` 读取完整 SSE 文本再解析。

### CORS 不一定是根因

如果 `OPTIONS` 正常但 `POST` 500/504，浏览器可能仍显示 CORS 类错误。

建议：优先看实际 `POST` 状态码、服务端日志和上游首包时间。

## EAS Build

常用命令：

```bash
# 预览 APK
cd apps/mobile
eas build --platform android --profile preview

# 生产 AAB
cd apps/mobile
eas build --platform android --profile production
```

检查项：

- `eas.json` 是否包含必要的 `EXPO_PUBLIC_*` 变量。
- Clerk 是否配置移动端 redirect scheme。
- 真机权限如相册、文件上传、Haptics 是否实际验证。

## 常用验证

```bash
pnpm start:mobile
pnpm --filter @notion/mobile lint
pnpm --filter @notion/mobile exec tsc --noEmit
```

## 关联文档

- 当前 Web / Mobile 差距：`web-mobile-gap-analysis.md`
- Mobile AI 历史排障复盘：`blog-archive.md`
- Fly.io 备用部署：`fly-io-deployment-guide.md`
