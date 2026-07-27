# Progress

`progress/` 保存阶段性过程摘要，回答“这一阶段具体改了什么、为什么这么改、当时怎么验证”。稳定结论优先看 [milestones](../milestones/README.md)，当前状态优先看根 [README](../README.md)。

## 阶段索引

| 需求 | 推荐文档 |
| --- | --- |
| 快速了解 5 月底 Web Agent / CLI / MCP 成型过程 | `20260527-20260531-consolidated.md` |
| 查看 Plan、MCP adapter、流式续跑治理 | `20260602-173825.md`、`20260605-233018.md`、`20260605-234802.md`、`20260606-*` |
| 查看 Agent Memory 产品化 | `20260603-170146.md` 到 `20260603-195302.md` |
| 查看 Mobile Agent Stream 和当前文档上下文 | `20260614-mobile-agent-stream-client.md`、`20260621-mobile-current-document-context.md` |
| 查看 CLI/MCP 独立发布 | `20260624-independent-mcp-server.md` |
| 查看编辑器 AI 稳定性修复与流式模块拆分 | `20260726-editor-ai-stability-and-stream-refactor.md` |

## 当前保留摘要

- `20260527-20260531-consolidated.md`：2026-05-27 至 2026-05-31 的阶段压缩记录，覆盖 Web Agent、RAG/Memory、CLI/Skills/MCP、Device Flow、npm 发布等已稳定工作。
- `20260602-173825.md`：M19 Plan 模式最小闭环，覆盖 Plan 模式入口、计划确认、确认后执行和路线调整。
- `20260602-cli-beta-1-release.md`：CLI `0.1.0-beta.1` 发布记录，覆盖发布前验证、npm 发布和发布后校验。
- `20260603-170146.md`：Agent Memory 重构方案拆分，生成 M23-M27 技术待办链路。
- `20260603-172805.md`：M23 Agent Memory Schema Foundation，覆盖 schema、兼容默认值、作用域、证据链和同步状态字段。
- `20260603-175455.md`：M24 Agent Memory Retrieval Runtime，覆盖 `memory_search`、纯读检索、scope-aware ranking 和 compact instruction memory。
- `20260603-181537.md`：M25 Agent Memory Inbox Confirmation，覆盖 pending proposal、Inbox、commit/reject 和确认式写入链路。
- `20260603-183215.md`：M26 Agent Memory Center UI，覆盖 `/memories` Memory Center、Overview、Inbox、Active、Conflicts、Settings 和 Detail Drawer。
- `20260603-195302.md`：M27 Agent Memory Eval And Auto Extraction，覆盖 Memory Eval、trace lifecycle、受控自动提取和 shadcn Select 统一。
- `20260605-233018.md`：M20 Web Agent MCP Adapter 最小闭环，覆盖受控 MCP 文档工具白名单、dry-run 强制保护和前端确认复用。
- `20260605-234802.md`：M21 韧性与治理最小闭环，覆盖流式安全重试、`tool-result-v1` 契约基建和 Plan 执行状态持久化。
- `20260606-091356.md`：Tool 结果契约全量统一，覆盖主要 Web Agent tools 的 `summary/sources/metadata/recoverable` 收敛。
- `20260606-095037.md`：强类型 Sources 与流式续跑协议设计，覆盖 `ToolResultSource` union 和 checkpoint/resume 协议。
- `20260606-100642.md`：流式续跑 Phase 1/2/3 落地，覆盖 run 控制事件、事件/checkpoint 持久化、backlog replay 和 checkpoint ReAct 恢复。
- `20260606-113248.md`：流式续跑可用性收口，覆盖“继续生成”入口和 resume 时完整 currentDocument 上下文恢复。
- `20260606-120002.md`：续跑一致性收口，覆盖 assistant 消息原地更新和 running run 长轮询接管。
- `20260614-mobile-agent-stream-client.md`：Mobile Agent Stream 客户端阶段收口，覆盖 `/api/agent/stream` 接入、AI Chat 状态机 hook、停止生成和移动端 typecheck 修复。
- `20260616-rag-adaptive-chunking.md`：RAG 自适应切分收口，覆盖 BlockNote 标题层级切分、语义边界合并、固定兜底和 Qdrant chunk metadata 扩展。
- `20260621-mobile-current-document-context.md`：Mobile currentDocument 上下文收口，覆盖文档详情页 AI 入口、Agent Stream 当前文档透传和移动端验证脚本补齐。
- `20260624-independent-mcp-server.md`：MCP 独立发布链路，覆盖内部 `@mynotion/agent-tools`、`@mynotion/mcp` 和 CLI 兼容入口。
- `20260726-editor-ai-stability-and-stream-refactor.md`：编辑器 AI 稳定性收口和流式模块拆分，覆盖 thinking mode 兼容、max_tokens、文本丢弃、模型切换、runReActLoop 返回最终状态和 ToolCallAccumulator 共享模块。

## 阅读规则

- 当前工程事实以根 `README.md`、`AGENTS.md`、`milestones/README.md` 为准。
- 本目录记录过程，不作为最新 API 或发布版本的唯一来源。
- 新增重大阶段改动时，按主题新增摘要或追加到 consolidated 记录；避免按小时继续生成碎片日志。
- 旧方案若已经被 milestone、release checklist 或当前 README 覆盖，应压缩、归档或删除重复段落。
