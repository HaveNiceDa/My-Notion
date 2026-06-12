# 2026-06-11 P0 Risk Fixes

## 目标

- 先修复当前巡检中识别出的 P0 风险：凭据暴露、Mobile AI API 契约断层、本地发布 token 明文文件，以及画板 legacy 大对象写入热路径。
- 画板策略从“迁移对象存储后恢复”调整为“功能下线”：前端不再进入画板后端，CLI/MCP 不再暴露画板能力。

## 已完成

- 将 `docs/fly-io-deployment-guide.md` 中的 LLM、Qdrant、SerpAPI 示例敏感值替换为占位符，避免继续在已跟踪文档中保留真实密钥样例。
- 删除本地忽略文件 `packages/my-notion-cli/.npmrc.publish`，降低 npm 发布 token 明文留存风险。
- 新增 Web 兼容路由 `/api/chat` 与 `/api/rag`，复用 `@notion/ai/server` 流式能力并接入 Clerk 鉴权、基础限流、SSE 输出和 CORS header。
- Mobile AI Client 请求 `/api/chat`、`/api/rag` 时携带 Clerk Bearer token，避免兼容路由成为未鉴权 LLM 入口。
- 为 legacy 画板写路径增加大小上限，阻止旧 Web/CLI/MCP 路径在对象存储迁移完成前继续写入超大 `sceneJson` 或 `thumbnailDataUrl`。
- 删除 Web 前端未接入的画板编辑/全屏/插入命令代码，并将历史 `whiteboard` block 收敛为只读废弃占位，避免前端再出现可触发画板后端读写的入口。
- 从 Web 依赖声明和 lockfile 中移除 `@excalidraw/excalidraw` 及对应 `@excalidraw/*` lockfile 解析块。
- 禁用 `my-notion whiteboards` 命令，移除 MCP whiteboard tools 注册、CLI HTTP client whiteboard 方法与相关类型。
- 从默认 PAT/Device Flow scope 中移除 `whiteboards:read/write`，并让 `/cli/v1/whiteboards*` Machine API 统一返回 `410 Gone`。

## 已知限制

- 已暴露过的密钥需要在外部平台轮换；代码层只能完成脱敏，不能撤销历史泄露。
- Mobile AI 仍是轻量 `/api/chat` / `/api/rag` 兼容层，尚未接入 Web Agent `/api/agent/stream` 的完整 tool-result、confirmation、resume 协议。
- 画板 schema、Convex public functions 与 `packages/business/whiteboard` DSL 暂时保留，避免历史数据和旧内部引用一次性断裂；确认无依赖后可继续删除。

## 验证

- `GetDiagnostics`：新增/修改的 Web API、Mobile AI Client、ChatModal、Convex whiteboard/CLI 文件未发现新增诊断问题。
- 命令行 `pnpm` / `corepack` / `node` 在当前非交互 shell 不可用，未能运行 `pnpm --filter @notion/web typecheck`、`pnpm --filter @mynotion/cli typecheck` 或 Mobile `tsc --noEmit`。
