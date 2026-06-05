# 画板带宽问题临时止血

## 背景

6 月 4 日 Convex Database Bandwidth 出现异常上涨，读带宽达到 GB 级，写带宽达到数百 MB。排查判断与近期上线的 Excalidraw 画板能力高度相关：`whiteboards` 表将 `sceneJson` 和 `thumbnailDataUrl` 大字符串放在 Convex DB 热路径中，且文档缩略图、全屏编辑器和 CLI list 等场景会读取完整画板记录。

## 临时处理

- 暂停 Web 编辑器 Slash 菜单中的画板入口，避免继续创建新的 `whiteboards` 记录。
- 已有文档中的 `whiteboard` 块保留 schema 解析，但只做静态缩略图/占位渲染，不再自动调用 `api.whiteboards.getById`。
- 暂停从旧画板块进入全屏编辑器，避免触发 `api.whiteboards.updateScene` 写入大字段。
- 保留 Convex whiteboards schema、functions、CLI/MCP 相关代码，避免破坏已有数据和后续迁移工具。

## 后续

- 完整根治方案见 `.trae/documents/whiteboard-bandwidth-r2-migration-plan.md`。
- 推荐后续将 `sceneJson` 与缩略图迁移到 Cloudflare R2/S3 对象存储，Convex 仅保留元数据、权限、索引和版本指针。
- 在新 Convex 项目线上稳定性确认后，再恢复画板能力并实施对象存储迁移。

## 验证

- `pnpm --filter @notion/web typecheck`
- `pnpm --filter @notion/web lint`
- `git diff --check`
