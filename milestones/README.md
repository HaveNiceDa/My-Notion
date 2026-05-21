# My-Notion 里程碑索引

## 目的

`progress/` 保留按时间叙事的详细过程日志，适合追溯每次改动。

`milestones/` 用于把过程日志收敛成阶段性结论，适合后续喂给 AI 快速理解项目状态。

## 阅读顺序

1. `M10-ai-chat-sidebar.md`：AI Chat 从独立页面重构为右侧可拖拽侧边栏面板。
2. `M11-ai-agent-architecture.md`：AI Chat 后端从单一 RAG pipeline 重构为 Agent + Tool 架构。

## 当前总状态

- M10 已启动：AI Chat 侧边栏重构方案已确定，待实施。
- M11 规划中：Agent 架构依赖 M10 完成后启动。

## 关键验证命令

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web build
pnpm --filter @notion/web lint
```
