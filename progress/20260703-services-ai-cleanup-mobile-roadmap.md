# 2026-07-03 services/ai 清理与 Mobile 路线收口

## 目标

按当前优先级先清理非主线独立 AI 服务风险面，再将 Mobile 后续主线拆成可执行里程碑。

## 已完成

- 删除 `services/ai` 独立 AI 服务目录，移除本地明文 `.env`、Docker/Fly/Vercel 部署入口和独立 Hono/Edge route。
- 删除 `docs/fly-io-deployment-guide.md`，不再保留 Fly.io 备用 AI 服务操作手册。
- `pnpm-workspace.yaml` 移除 `services/*` workspace。
- 运行 `pnpm install --lockfile-only --ignore-scripts`，从 `pnpm-lock.yaml` 移除 `services/ai` importer。
- 更新 `docs/README.md`、`docs/mobile-debug-guide.md`、`docs/blog-archive.md`、`apps/mobile/README.md`，将 Mobile AI 口径收敛为 Web API / Web Agent。
- Mobile Web Agent 地址改为优先读取 `EXPO_PUBLIC_WEB_AGENT_URL`，旧 `EXPO_PUBLIC_AI_SERVICE_URL` 仅作为兼容 fallback；EAS 和本地脚本已切换到新变量。
- 新增 `milestones/M29-mobile-ai-native-client.md`：Mobile Agent Stream 真机、弱网、resume、本地缓存和错误边界。
- 新增 `milestones/M30-mobile-editor-deepening.md`：移动编辑器正文图片、复杂 block 降级、键盘/选区和长文编辑体验。
- 更新 `milestones/README.md`，将 M29/M30 从候选推进为规划中。

## 验证

- `pnpm install --lockfile-only --ignore-scripts`：通过，刷新 workspace lockfile
- `pnpm --filter @notion/ai typecheck`：通过
- `pnpm --filter @notion/web typecheck`：通过
- `pnpm --filter @notion/mobile typecheck`：通过
- `pnpm --filter @notion/web build`：通过，Sentry auth token 缺失仅导致 sourcemap/release 上传 warning
- `pnpm --filter @mynotion/cli typecheck`：通过
- `pnpm --filter @mynotion/mcp typecheck`：通过
- `rg` 检查当前 README/docs/apps/packages/scripts/workspace/lockfile/milestones：无 `services/ai` 当前入口残留引用

## 已知风险

- `EXPO_PUBLIC_AI_SERVICE_URL` 作为兼容 fallback 仍保留在代码中；确认所有环境迁移后可删除 fallback。
- `my-notion-go/` 和历史博客中可能仍有早期 AI 服务探索记录，不作为当前主线处理。
