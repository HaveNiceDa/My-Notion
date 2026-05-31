# CLI 授权页 UI 与 i18n 优化

## 背景

本地 CLI Device Flow 已走通，但授权页仍是临时卡片样式，缺少多语言、主题切换、语言切换和品牌 logo，不符合正式授权体验。

## 本次改动

- 重构 `apps/web/src/app/[locale]/cli/auth/page.tsx`：
  - 使用 My-Notion logo 展示品牌与 CLI 授权关系。
  - 顶部加入 `LanguageToggle` 和 `ModeToggle`。
  - 页面视觉参考飞书授权页：居中品牌卡片、验证码重点展示、请求详情、权限说明、安全提示和双按钮授权操作。
  - 所有用户可见文案接入 `next-intl`。
- 在 `packages/business/i18n/en.json` 和 `packages/business/i18n/zh-CN.json` 新增 `CliAuth` 命名空间。

## 验证

- `pnpm --filter @notion/web typecheck`
- `pnpm --filter @notion/web lint`
- 后续继续跑 `pnpm --filter @notion/web build`
