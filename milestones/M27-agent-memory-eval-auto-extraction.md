# M27 Agent Memory Eval And Auto Extraction

## 状态

- 状态：已完成
- 完成时间：2026-06-03
- 过程记录：`progress/20260603-195302.md`

## 目标

在 M23-M26 建立可治理 Memory 基础后，引入 Memory Eval、Trace 观测和受控自动提取，让 Agent 能从会话中自动提出有价值的记忆候选，但默认进入 Inbox，不直接污染 active memory。

本阶段解决“如何让 Memory 持续变好、如何衡量召回质量、如何安全自动积累”的问题。

## 对齐总方案

来源文档：

- `docs/agent-memory-redesign-report.md`

对应总方案章节：

- `10. 验证与评估体系`
- `11. 分阶段实施路线` 的 Milestone E
- `12.2 不建议自动写 active memory`
- `13. 建议优先级` 的后续增强

## 前置依赖

- 必须完成 M23：需要 Memory 分层、证据、治理字段。
- 必须完成 M24：需要 `memory_search` 和纯读检索。
- 必须完成 M25：需要 Inbox 接收自动提取候选。
- 建议完成 M26：自动提取和 Eval 结果需要 UI 承接。

## 范围

### In Scope

- 新增 Memory retrieval eval fixtures 和 runner。
- 新增 Memory write quality eval。
- 新增 duplicate/conflict eval。
- 在 Agent trace 中记录 memory injected/search/proposed/committed 事件。
- 实现 session end / compact 后的 memory candidate extractor。
- 自动提取结果默认进入 Inbox。
- 增加自动提取开关和安全策略。

### Out of Scope

- 不自动写入 active memory。
- 不做模型微调。
- 不做完整 Trace Replay 平台。
- 不要求复杂 Dashboard，但应为后续 UI 暴露基础数据。

## 评估体系

### Retrieval Eval

目标：衡量 `memory_search` 是否召回正确记忆。

Fixture 示例：

```ts
{
  query: "以后写移动端文案要注意什么？",
  scope: { level: "project", key: "mobile" },
  expectedMemoryIds: ["memory-mobile-i18n"],
  forbiddenMemoryIds: ["memory-web-only-rule"],
}
```

指标：

- Recall@K
- Precision@K
- MRR
- wrong-scope hit rate
- stale hit rate
- sensitive leakage rate

### Write Quality Eval

目标：衡量 Agent 提议保存的 memory 是否值得保存。

维度：

- 是否长期有价值。
- 是否应该是 instruction/semantic/episodic/procedural。
- scope 是否正确。
- content 是否简洁可审查。
- 是否包含敏感信息。
- 是否重复已有 memory。

### Conflict Eval

目标：衡量系统是否能发现重复、覆盖、冲突。

用例：

- 新偏好覆盖旧偏好。
- 项目规则与用户偏好冲突。
- 同一事实重复表达。
- 临时任务状态不应升级为长期规则。

## 自动提取器设计

### 触发时机

候选触发点：

- 会话结束。
- 用户执行类似 compact 的上下文压缩。
- Agent 完成多工具任务。
- 用户明确给出反馈，如“以后别这样”。

M27 先实现服务端可调用 extractor，不强依赖完整 session lifecycle。

### 输入

```ts
{
  userId: string;
  conversationId: string;
  messages: Array<...>;
  toolResults?: Array<...>;
  currentDocument?: ...;
  scope?: ...;
}
```

### 输出

```ts
{
  proposals: Array<{
    kind: "instruction" | "semantic" | "episodic" | "procedural";
    category: string;
    scope: { level: string; key: string };
    content: string;
    summary?: string;
    evidenceText: string;
    confidence: number;
    importance: number;
    reason: string;
    duplicateCandidates?: string[];
    conflictCandidates?: string[];
  }>;
}
```

### 安全规则

- 自动提取结果只能创建 `pending_review`。
- 敏感内容默认不提取，或标记 `privacy=sensitive` 并要求人工确认。
- 低置信度 proposal 不进入 Inbox，可只写 trace。
- 不从未验证的网页内容中自动生成 instruction memory。
- 不把单次失败直接升级为长期规则，除非用户明确确认。

## 涉及文件

### 必改或新增

- `packages/ai/eval/memory-retrieval-eval-fixtures.ts`
- `packages/ai/eval/memory-retrieval-evaluator.ts`
- `packages/ai/eval/memory-write-evaluator.ts`
- `packages/ai/eval/memory-conflict-evaluator.ts`
- `packages/ai/eval/memory-eval-runner.ts`
- `apps/web/src/lib/agent/memory-extractor.ts`
- `apps/web/src/lib/agent/trace.ts`
- `apps/web/src/lib/agent/tools/memory.ts`
- `packages/convex/agentMemories/logic/create.ts`

### 可能修改

- `package.json`
- `scripts/ci-ai-smoke.mjs`
- `apps/web/src/app/api/agent/stream/route.ts`
- `apps/web/src/components/ai-chat/memory/MemoryOverview.tsx`
- `apps/web/src/components/ai-chat/memory/MemorySettings.tsx`

## 任务拆分

1. 新增 memory retrieval eval fixtures。
2. 实现 memory retrieval evaluator。
3. 实现 write quality evaluator。
4. 实现 conflict evaluator。
5. 增加 `pnpm eval:memory` 或整合进 `pnpm ci:ai-smoke`。
6. 扩展 Agent trace，记录 memory lifecycle 事件。
7. 实现 memory extractor，输出 pending proposals。
8. 接入 M25 Inbox。
9. 增加自动提取开关。
10. 补充测试和文档。

## 验收标准

- 可以本地运行 Memory eval。
- `memory_search` 的召回质量有基础指标。
- 自动提取不会直接写 active memory。
- 自动提取候选进入 Inbox。
- Trace 能看到 memory injected/search/proposed/committed。
- 低置信度、敏感、无证据候选不会污染 Inbox。

## 验证命令

```bash
pnpm eval:memory
pnpm ci:ai-smoke
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
```

如未新增 `eval:memory` 脚本，至少运行：

```bash
pnpm test
```

## 风险

- 自动提取容易生成噪音，默认必须保守。
- Eval fixture 过少会产生虚假信心，应持续补真实脱敏样本。
- 自动提取依赖 LLM，需控制成本和频率。
- Trace 数据可能包含敏感信息，写入前要做摘要和脱敏。

## 与后续路线衔接

M27 完成后，Memory 主链路具备：

```text
Schema foundation
  -> Runtime retrieval
  -> Inbox confirmation
  -> Memory Center
  -> Eval + auto extraction
```

后续可进入：

- Tool Trace Replay。
- Memory/RAG 真实质量评估。
- Web Agent MCP adapter 与 Memory policy 联动。
- Mobile AI/RAG 对齐。
