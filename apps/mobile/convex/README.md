# Mobile Convex

`apps/mobile/convex` 是 Mobile 应用的 Convex 后端入口，主要复用 `packages/convex` 的共享 schema 和业务逻辑，并承载移动端需要的轻量封装。

## 当前职责

- 让 Expo Mobile 端访问与 Web 一致的文档、Chat、用户和共享 schema。
- 复用 `@notion/convex` 中的 documents、aiChat、settings 等业务逻辑。
- 保持 Mobile Convex API 与 Web 数据模型一致，避免双端 schema 漂移。

## 修改规则

- 修改本目录前先阅读 `apps/mobile/AGENTS.md`。
- 修改 `apps/mobile/convex` 前必须阅读 `apps/mobile/convex/_generated/ai/guidelines.md`。
- 优先在 `packages/convex` 中沉淀共享逻辑，本目录只保留端侧入口和必要差异。
- 不要引入只适用于 Web 的 Clerk/Next.js runtime 假设。

## 常用验证

```bash
pnpm --filter @notion/mobile lint
pnpm --filter @notion/mobile exec tsc --noEmit
```

涉及共享 Convex schema 或 Web/Mobile 双端行为时，追加：

```bash
pnpm --filter @notion/web exec convex codegen
pnpm --filter @notion/web typecheck
```
