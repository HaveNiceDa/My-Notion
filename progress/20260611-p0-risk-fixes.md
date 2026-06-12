# 2026-06-11 P0 Risk Fixes

## 目标

- 先修复当前巡检中识别出的 P0 风险：凭据暴露、Mobile AI API 契约断层、本地发布 token 明文文件，以及画板 legacy 大对象写入热路径。
- 本轮以止血和最小兼容为主，不提前恢复 Web 画板入口；完整对象存储迁移继续保留为 M22.3。

## 已完成

- 将 `docs/fly-io-deployment-guide.md` 中的 LLM、Qdrant、SerpAPI 示例敏感值替换为占位符，避免继续在已跟踪文档中保留真实密钥样例。
- 删除本地忽略文件 `packages/my-notion-cli/.npmrc.publish`，降低 npm 发布 token 明文留存风险。
- 新增 Web 兼容路由 `/api/chat` 与 `/api/rag`，复用 `@notion/ai/server` 流式能力并接入 Clerk 鉴权、基础限流、SSE 输出和 CORS header。
- Mobile AI Client 请求 `/api/chat`、`/api/rag` 时携带 Clerk Bearer token，避免兼容路由成为未鉴权 LLM 入口。
- 为 legacy 画板写路径增加大小上限，阻止旧 Web/CLI/MCP 路径在对象存储迁移完成前继续写入超大 `sceneJson` 或 `thumbnailDataUrl`。
- 删除 Web 前端未接入的画板编辑/全屏/插入命令代码，并将历史 `whiteboard` block 收敛为只读废弃占位，避免前端再出现可触发画板后端读写的入口。

## 已知限制

- 已暴露过的密钥需要在外部平台轮换；代码层只能完成脱敏，不能撤销历史泄露。
- Mobile AI 仍是轻量 `/api/chat` / `/api/rag` 兼容层，尚未接入 Web Agent `/api/agent/stream` 的完整 tool-result、confirmation、resume 协议。
- 画板前端已下掉编辑能力；如果后续决定彻底删除服务端能力，还需单独移除 CLI/MCP whiteboard routes、scope、Convex functions 和业务包 DSL。

## 验证

- `GetDiagnostics`：新增/修改的 Web API、Mobile AI Client、ChatModal、Convex whiteboard/CLI 文件未发现新增诊断问题。
- 命令行 `pnpm` / `corepack` / `node` 在当前非交互 shell 不可用，未能运行 `pnpm --filter @notion/web typecheck`、`pnpm --filter @mynotion/cli typecheck` 或 Mobile `tsc --noEmit`。
