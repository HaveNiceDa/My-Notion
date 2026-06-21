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

## 真机验证清单

### 文档页 AI 当前文档

前置条件：

- `EXPO_PUBLIC_AI_SERVICE_URL` 指向可被真机访问的 Web/AI 服务地址。
- 目标文档包含标题、正文段落和至少一次未等待防抖保存的编辑。

检查步骤：

1. 打开文档详情页，修改标题或正文。
2. 立即点击右上角 AI 图标打开 Chat。
3. 发送“总结当前文档”。
4. 确认 Agent 能读取当前文档内容，且结果包含刚刚编辑但可能尚未防抖保存的内容。

通过标准：

- 服务端 `/api/agent/stream` 收到 `currentDocument.id/title/content`。
- Mobile 端能展示流式文本、tool event 和来源。
- 从来源跳转回文档不崩溃。

### 正文图片上传

前置条件：

- 真机已授予相册权限。
- Web `/api/upload-image` 和 EdgeStore 配置可用。

检查步骤：

1. 打开文档详情页，点击“插入图片”。
2. 选择一张合法图片，等待上传和保存完成。
3. 退出文档后重新进入。
4. 断网后再次点击“插入图片”。

通过标准：

- 合法图片能插入正文并持久化，重开文档后仍可渲染。
- 插入后立即返回页面，不应丢失图片节点。
- 断网时不会长时间挂起，能给出失败提示。
- 权限拒绝、用户取消、上传失败不会破坏已有正文内容。

### 续跑与弱网

检查步骤：

1. 发送一个较长 AI 请求，生成中切到后台。
2. 回到 App 后点击继续生成。
3. 生成中关闭网络，恢复网络后再次继续生成。

通过标准：

- 切后台和断网会进入可恢复状态。
- 继续生成不会重复已应用的文本片段。
- 失败提示不暴露 token、完整服务端错误或敏感响应。

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
