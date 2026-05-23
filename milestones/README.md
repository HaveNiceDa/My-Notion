# My-Notion 里程碑索引

## 目的

`progress/` 保留按时间叙事的详细过程日志，适合追溯每次改动。

`milestones/` 用于把过程日志收敛成阶段性结论，适合后续喂给 AI 快速理解项目状态。

## 阅读顺序

1. `M10-ai-chat-sidebar.md`：AI Chat 从独立页面重构为右侧可拖拽侧边栏面板。
2. `M11-agent-stream-rag-tool.md`：AI Chat 后端从单一 RAG pipeline 重构为 Agent + Tool 架构。
3. `M12-agent-auto-tool-routing.md`：移除显式 RAG 开关，Agent 统一 auto 模式。
4. `M13-document-read-tool.md`：当前文档读取能力接入 Agent 体系。
5. `M14-react-agent-loop.md`：硬编码 tool 路由重构为标准 ReAct 循环，LLM 自主决策工具调用。

## 当前总状态

- M10 ✅ 已完成：AI Chat 侧边栏重构。
- M11 ✅ 已完成：Agent Stream + Knowledge Search Tool。
- M12 ✅ 已完成：Agent Auto Tool Routing。
- M13 ✅ 已完成：Document Read Tool。
- M14 ✅ 已完成：ReAct Agent Loop 重构。

## 关键验证命令

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web build
pnpm --filter @notion/web lint
```
