# My-Notion Docs

本目录只放当前仍需维护的工程文档：方案设计、操作手册、发布检查和外部 AI 参考。项目状态以根目录 `README.md`、`AGENTS.md`、`milestones/README.md` 和本索引为准。

## 快速入口

| 场景 | 推荐入口 |
| --- | --- |
| 快速理解当前工程状态 | 先读根 README，再读 [milestones/README.md](../milestones/README.md) |
| 要继续开发 Web Agent | [ai-chat-refactor-plan.md](./ai-chat-refactor-plan.md)、[agent-stream-resume-protocol.md](./agent-stream-resume-protocol.md) |
| 要做 Mobile 客户端能力 | [web-mobile-gap-analysis.md](./web-mobile-gap-analysis.md)、[mobile-debug-guide.md](./mobile-debug-guide.md) |
| 要发布 CLI / MCP | [my-notion-cli-release-checklist.md](./my-notion-cli-release-checklist.md)、[my-notion-mcp-release-checklist.md](./my-notion-mcp-release-checklist.md) |

## 当前维护文档

| 文档 | 用途 |
| --- | --- |
| [ai-chat-refactor-plan.md](./ai-chat-refactor-plan.md) | Web Agent 当前基线和后续路线，适合接手 Agent 工作前快速校准。 |
| [web-mobile-gap-analysis.md](./web-mobile-gap-analysis.md) | Web / Mobile 差距、已完成能力和下一步客户端建设路线。 |
| [agent-stream-resume-protocol.md](./agent-stream-resume-protocol.md) | Agent 流式续跑协议，覆盖事件序号、checkpoint、backlog replay 和安全恢复。 |
| [agent-document-write-format-strategy.md](./agent-document-write-format-strategy.md) | Agent 写文档时 Markdown 与 BlockNote JSON 的格式边界和转换策略。 |
| [agent-memory-redesign-report.md](./agent-memory-redesign-report.md) | Agent Memory 从 MVP 升级为 Context Governance System 的完整设计。 |
| [blocknote-ai-editor-refactor-plan.md](./blocknote-ai-editor-refactor-plan.md) | BlockNote 编辑器 AI 的重构建议和风险点。 |

## 操作手册

| 文档 | 用途 |
| --- | --- |
| [mobile-debug-guide.md](./mobile-debug-guide.md) | Expo 环境变量、路由、真机、弱网、Agent Stream 和图片上传排查。 |
| [my-notion-cli-release-checklist.md](./my-notion-cli-release-checklist.md) | CLI / Skills 发布前检查，覆盖验证、npm、登录和安全输出。 |
| [my-notion-mcp-release-checklist.md](./my-notion-mcp-release-checklist.md) | 独立 MCP 发布前检查，覆盖 pack、stdio、SDK client 和 npm smoke。 |
| [fly-io-deployment-guide.md](./fly-io-deployment-guide.md) | `services/ai` 的 Fly.io 备用部署方案，作为 Vercel 网络不稳时的选项。 |

## 外部 AI 参考

- [ai-docs/README.md](./ai-docs/README.md)：DashScope / OpenAI Compatible API / Tool / MCP 参考资料索引。
- `ai-docs/**` 不属于项目过程记录，开发 Agent、流式输出、Function Calling、联网搜索和网页抽取前按需读取。

## 清理原则

- 当前工程事实以根 README、AGENTS、milestones 和本目录当前维护文档为准。
- 已完成的大段实施过程优先压缩到 `progress/`，不要继续堆新的长篇流水账。
- 过期方案若已被里程碑、release checklist 或现行 README 覆盖，应删除而不是继续留在根 `docs/`。
- `my-notion-go/` 是早期探索工程，除非任务明确提到，否则不作为当前主线文档入口。
