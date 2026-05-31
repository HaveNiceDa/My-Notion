# Web Convex

`apps/web/convex` 是 Web 应用的 Convex 后端入口，负责 re-export / wiring 共享 Convex 逻辑，并承载 Web 专属 HTTP Actions。

## 当前职责

- 暴露 Web 端使用的 Convex queries / mutations / actions。
- 暴露 `/cli/v1/*` Machine API HTTP Actions，供 `@mynotion/cli` 和 MCP STDIO server 调用。
- 对接 Clerk 登录身份和 CLI PAT 身份解析。
- 复用 `packages/convex` 中的 schema、documents、chat、cli token 等共享逻辑。

## 修改规则

- 修改本目录前先阅读 `apps/web/AGENTS.md`。
- 修改 `apps/web/convex` 前必须阅读 `apps/web/convex/_generated/ai/guidelines.md`。
- Machine API 对外使用 Convex `.site` URL；Convex client/runtime 使用 `.cloud` URL。
- 不得信任客户端传入的 `userId`，CLI 请求必须由 PAT 服务端解析身份。
- 不得在日志、审计记录或错误响应中输出完整 PAT、token hash 或 query string。

## 常用验证

```bash
pnpm --filter @notion/web exec convex codegen
pnpm --filter @notion/web typecheck
pnpm e2e:cli
pnpm e2e:cli:errors
pnpm e2e:mcp
```
