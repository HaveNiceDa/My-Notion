# CLI 与画板契约加固

## 背景

本次集中收敛 CLI 文档写入安全、画板 DSL 稳定布局、画板导出备份、白板权限最小化与 Excalidraw scene 迁移能力。

## 变更

- 文档更新默认行为统一为 `append`；仅显式 `--mode overwrite` 或 `mode: "overwrite"` 时覆盖全文。
- `mwb-dsl-v1` 增加可选 `layout` contract，支持 `kind`、`rankDirection`、`spacing`、`bounds`，用于稳定 Agent 生成图的布局。
- 白板导出新增 `package` 格式，包含 `scene.json`、`thumbnail.txt`、`whiteboard.svg`，CLI 支持写入目录。
- CLI Machine API 将画板权限拆分为 `whiteboards:read` / `whiteboards:write`，默认 Device Flow 与默认 PAT 增加对应 scope。
- Excalidraw scene 增加 `myNotionSceneVersion`，并在保存、读取、CLI 写入路径接入迁移与临时 UI 状态清洗。

## 验证

- `pnpm --filter @notion/web typecheck`
- `pnpm --filter @mynotion/cli typecheck`
- `pnpm --filter @mynotion/cli test`
- `pnpm sync:skills`
- `pnpm sync:skills:package`
- `pnpm sync:skills:check`
