# Excalidraw Whiteboard Foundation

## 背景

为 My-Notion 增加类似飞书文档 + 飞书画板的能力：文档内展示画板缩略图，点击进入全屏画板编辑，并允许 `mynotion-cli` / MCP 通过 AI 友好的 DSL 创建和更新画板。

## 本阶段完成

- 锁定 Excalidraw 作为画板 MVP 基准方案，tldraw 仅作为远期体验参考。
- 新增 `whiteboards` Convex 表，画板 scene 与文档正文解耦，文档只保存 `whiteboard` block 引用。
- 新增共享 `mwb-dsl-v1` 类型与 DSL -> Excalidraw scene 转换器。
- Web 端新增 Excalidraw 全屏编辑器、缩略图卡片和 BlockNote 自定义 `whiteboard` block。
- Slash Menu 新增 `/画板` 入口，可在当前文档中创建画板引用块。
- CLI 新增 `whiteboards` 命令组，支持 create/fetch/list/update/export/archive。
- MCP 新增 `my_notion_whiteboards_*` 工具，写入类工具默认 dry-run。
- Markdown 导出遇到 `whiteboard` block 时输出 `mynotion-whiteboard://<id>` 稳定占位。
- Web 交互已按飞书画板方向收敛：文档内展示整宽纯缩略图，单击进入全屏画板，左上角支持退出和编辑画板名称。
- 缩略图加载态已改为 loading 动画，移除点阵背景和画笔占位；Slash 菜单画板图标改为绘图类图标，并补充 `Media` / `媒体` 分组国际化。
- 全屏画板弹层改为画板专用白色全屏过渡，复用已加载画板数据以减少进入/退出闪烁。

## 关键约束

- 首版不做实时多人协作。
- 首版不把完整 sceneJson 注入 RAG，仅保留标题/DSL 摘要策略。
- CLI/Agent 不直接生成 BlockNote JSON，只通过 `mwb-dsl-v1` 创建或更新画板资源。

## 后续

- 增加更完善的 Excalidraw thumbnail 生成与 SVG 导出保真。
- 为 DSL 布局增加更强的自动排布与冲突检测。
- 视体验需要补充独立画板页面、移动端只读预览和 Agent 画板生成工具卡片。
- 画板缩略图仍依赖退出/保存时生成，后续可继续优化为空画板预览、缩略图生成频率和更高保真导出。
- 暂未实现多人协作、移动端完整编辑、Agent 根据文档一键生成画板的产品化工具卡片。

## 验证补充

- `pnpm --filter @mynotion/cli build` 通过。
- `pnpm e2e:cli` 通过，覆盖 CLI 构建、认证、文档 CRUD、导入导出、归档和登出主链路。
- `pnpm e2e:mcp` 通过，覆盖 MCP STDIO 初始化、工具列表、dry-run 写入约束、创建/读取/更新/搜索和归档清理。
- `GetDiagnostics` 未发现新增诊断问题。
