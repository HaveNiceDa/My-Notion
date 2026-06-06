# My-Notion Docs

本目录只保留当前仍有维护价值的工程文档、操作手册和压缩后的历史复盘。需要快速理解项目状态时，优先阅读根目录 `README.md`、`AGENTS.md`、`milestones/README.md` 和 `progress/README.md`。

## 当前维护文档

| 文档 | 用途 |
| --- | --- |
| [ai-chat-refactor-plan.md](./ai-chat-refactor-plan.md) | Web Agent 当前基线与 M19-M22 下一阶段路线。 |
| [web-mobile-gap-analysis.md](./web-mobile-gap-analysis.md) | 当前 Web / Mobile 能力差距与后续 backlog。 |
| [blocknote-ai-editor-refactor-plan.md](./blocknote-ai-editor-refactor-plan.md) | BlockNote 编辑器 AI 的当前重构建议。 |
| [agent-document-write-format-strategy.md](./agent-document-write-format-strategy.md) | Agent 文档读写格式策略：Markdown <-> BlockNote blocks 双向转换。 |
| [agent-stream-resume-protocol.md](./agent-stream-resume-protocol.md) | Web Agent 完整流式续跑 checkpoint/resume 协议设计。 |
| [my-notion-cli-release-checklist.md](./my-notion-cli-release-checklist.md) | `@mynotion/cli` / MCP / Skills 发布检查清单。 |

## 操作手册

| 文档 | 用途 |
| --- | --- |
| [mobile-debug-guide.md](./mobile-debug-guide.md) | Expo Mobile 环境变量、路由、构建和真机调试排查手册。 |
| [fly-io-deployment-guide.md](./fly-io-deployment-guide.md) | `services/ai` 的 Fly.io 备用部署方案。 |

## 历史复盘

| 文档 | 用途 |
| --- | --- |
| [blog-archive.md](./blog-archive.md) | 已完成技术文章/排障复盘的压缩索引，替代原 `blog-*.md` 长文。 |

## 外部 AI 参考

- [ai-docs/README.md](./ai-docs/README.md)：DashScope / OpenAI Compatible API / Tool / MCP 参考资料索引。
- `ai-docs/**` 不属于项目过程记录，开发 Agent、流式输出、Function Calling、联网搜索和网页抽取前按需读取。

## 清理规则

- 当前工程事实以根 README、AGENTS、milestones 和本目录当前维护文档为准。
- 已完成的大段实施过程优先压缩到 `progress/` 或 `blog-archive.md`，不要继续堆长篇流水账。
- 过期方案若已被里程碑、release checklist 或现行 README 覆盖，应删除而不是继续留在根 `docs/`。
