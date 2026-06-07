# 2026-06-07 Whiteboard Web Entry Disable

## 背景

- M22.1/M22.2 已将画板查询拆成 preview/scene，但前端渲染已有画板 Block 时仍会订阅 `api.whiteboards.getPreviewById`。
- 当前目标调整为先暂停 Web 端画板入口和前端数据流量，后端 CLI、Convex API 与订阅链路暂不处理。

## 改动

- `WhiteboardThumbnail` 移除 Clerk/Convex 查询，不再订阅 `getPreviewById`。
- `WhiteboardThumbnail` 不再渲染 `thumbnailUrl` 图片，避免已有文档画板块触发图片资源请求。
- `WhiteboardFullscreenDialog` 移除 `getSceneById`、`updateScene`、对象存储 `fetch` 与 `WhiteboardEditor` 挂载，误打开时仅展示暂停提示。
- `createInsertWhiteboardItem` 点击变为 no-op，避免未来误接入后创建画板数据。
- 中英文 i18n 将画板描述改为临时关闭状态。

## 当前状态

- Web 前端不再存在 `api.whiteboards` 调用点。
- 画板 Block schema 保留，以保证已有文档可解析和显示静态占位。
- 后端 Convex whiteboards API、CLI/MCP 画板能力保持不变，后续如继续 M22 迁移再处理。
