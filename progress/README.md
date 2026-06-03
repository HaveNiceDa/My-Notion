# Progress

`progress/` 只保留阶段性过程摘要，不再保存每次微调的完整流水账。

## 当前保留

- `20260527-20260531-consolidated.md`：2026-05-27 至 2026-05-31 的阶段压缩记录，覆盖 Web Agent、RAG/Memory、CLI/Skills/MCP、Device Flow、npm beta 发布等已稳定工作。
- `20260602-173825.md`：M19 Plan 模式最小闭环，覆盖 Plan 模式入口、计划确认、确认后执行和路线调整。
- `20260602-cli-beta-1-release.md`：CLI `0.1.0-beta.1` 发布记录，覆盖发布前验证、npm 发布和发布后校验。
- `20260603-170146.md`：Agent Memory 重构方案拆分，生成 M23-M27 技术待办链路。
- `20260603-172805.md`：M23 Agent Memory Schema Foundation，覆盖 schema、兼容默认值、作用域、证据链和同步状态字段。
- `20260603-175455.md`：M24 Agent Memory Retrieval Runtime，覆盖 `memory_search`、纯读检索、scope-aware ranking 和 compact instruction memory。
- `20260603-181537.md`：M25 Agent Memory Inbox Confirmation，覆盖 pending proposal、Inbox、commit/reject 和确认式写入链路。
- `20260603-183215.md`：M26 Agent Memory Center UI，覆盖 `/memories` Memory Center、Overview、Inbox、Active、Conflicts、Settings 和 Detail Drawer。
- `20260603-195302.md`：M27 Agent Memory Eval And Auto Extraction，覆盖 Memory Eval、trace lifecycle、受控自动提取和 shadcn Select 统一。

## 阅读规则

- 需要快速了解当前状态：优先读根 `README.md`、`AGENTS.md`、`milestones/README.md`。
- 需要追溯历史过程：再读本目录的 consolidated 记录。
- 新增重大阶段改动时，优先追加到 consolidated 或新增按主题命名的阶段摘要，避免按小时生成碎片日志。
