# M24 Agent Memory Retrieval Runtime

## 目标

在 M23 的 schema 基础上，重构 Agent Memory 的读取与运行时注入机制：移除读路径 upsert，引入 scope-aware `memory_search`，并把自动注入收敛为 compact instruction memory。

本阶段解决“记忆如何被正确召回、何时进入上下文、如何避免污染 system prompt”的问题。

## 对齐总方案

来源文档：

- `docs/agent-memory-redesign-report.md`

对应总方案章节：

- `5. 目标架构`
- `7. Agent 读写链路重构规格`
- `9. 迁移方案` 的 Phase 3 和 Phase 4
- `13. 建议优先级` 中的移除读路径 upsert、scope-aware retrieval、compact instruction memory

## 前置依赖

- 必须完成 M23。
- 依赖 M23 的字段：`kind`、`category`、`scopeLevel`、`scopeKey`、`importance`、`stability`、`privacy`、`embeddingStatus`。
- 不依赖 M25-M27。

## 范围

### In Scope

- 将 `retrieveRelevantMemories` 改为纯读，禁止查询时 upsert Qdrant。
- 新增或重命名 `memory_search` tool，支持 `query/kinds/categories/scopes/limit/includeEvidence`。
- 保留 `memory_read` 兼容 alias，避免一次性破坏现有 Tool 卡片和测试。
- 实现 scope-aware memory 排序，输出 `scoreBreakdown`。
- 调整 `/api/agent/stream` 中的启动前注入策略，只注入 compact instruction memory。
- 在 Agent trace 中记录 injected memory ids、searched memory ids。
- 新增检索相关单测。

### Out of Scope

- 不实现 Inbox。
- 不实现 Memory Center UI。
- 不实现自动提取。
- 不做复杂 LLM rerank。
- 不引入图谱数据库。

## 关键设计

### 读路径必须无副作用

当前问题：

```text
retrieveRelevantMemories
  -> upsert active memories
  -> semantic search
```

目标：

```text
retrieveRelevantMemories
  -> semantic search existing vector index
  -> fallback rank Convex records
```

向量同步只允许发生在：

- memory create/update/delete 写路径。
- 后台 sync job。
- 显式 repair/sync API。

### Tool 设计

新增 `memory_search`：

```ts
{
  query: string;
  kinds?: Array<"instruction" | "semantic" | "episodic" | "procedural">;
  categories?: string[];
  scopes?: Array<{ level: string; key: string }>;
  limit?: number;
  includeSensitive?: boolean;
  includeEvidence?: boolean;
}
```

返回：

```ts
{
  query: string;
  memories: Array<{
    id: string;
    kind: string;
    category: string;
    scope: { level: string; key: string };
    content: string;
    summary?: string;
    confidence: number;
    importance: number;
    score: number;
    scoreBreakdown: {
      semantic?: number;
      scope?: number;
      importance?: number;
      confidence?: number;
      recency?: number;
      usage?: number;
      stalenessPenalty?: number;
    };
    evidence?: {
      conversationId?: string;
      messageId?: string;
      documentId?: string;
      sourceText?: string;
    };
  }>;
  metadata: {
    retrieval: "semantic" | "hybrid" | "fallback";
    count: number;
    unavailable?: boolean;
    error?: string;
  };
}
```

### 排序公式

M24 实现一个轻量版：

```text
finalScore =
  semanticScore * 0.45
  + scopeScore * 0.20
  + importance * 0.15
  + confidence * 0.10
  + recencyScore * 0.05
  + usageScore * 0.05
  - stalenessPenalty
```

M24 不要求所有字段都有完美数据，但必须输出可解释 `scoreBreakdown`。

### Compact Instruction Memory

请求开始时只自动注入：

- `kind = instruction`
- `status = active`
- 当前 scope 匹配或 user/global scope
- `privacy = normal`
- `importance` 高
- 控制 token budget

其他 semantic/episodic/procedural memory 通过 `memory_search` tool 获取。

## 涉及文件

### 必改

- `packages/ai/server/memory.ts`
- `packages/ai/rag/qdrantVectorStore.ts`
- `apps/web/src/lib/agent/tools/memory.ts`
- `apps/web/src/lib/agent/tools/definitions.ts`
- `apps/web/src/lib/agent/tools/registry.ts`
- `apps/web/src/app/api/agent/stream/route.ts`
- `apps/web/src/lib/agent/__tests__/tools.test.ts`

### 可能修改

- `apps/web/src/components/ai-chat/ToolCallCard.tsx`
- `packages/business/i18n/zh-CN.json`
- `packages/business/i18n/en.json`
- `packages/ai/__tests__/memory-retrieval.test.ts`

## 任务拆分

1. 拆分 `syncAgentMemory` 与 `retrieveRelevantMemories` 职责，移除查询 upsert。
2. 增加 `memory_search` tool definition 和 execute 函数。
3. 将 `memory_read` 保留为兼容 alias，内部复用 `memory_search`。
4. 实现 scope/kind/category/status/privacy 过滤。
5. 实现轻量 scoreBreakdown。
6. 修改 `/api/agent/stream` 的 `buildMemoryContext` 为 `buildInstructionMemoryContext`。
7. 在 trace metadata 中记录 memory 注入与检索结果。
8. 更新 ToolCallCard 的展示兼容。
9. 增加测试覆盖。

## 验收标准

- 读路径不再写 Qdrant。
- `memory_search` 可按 scope/kind/category 检索。
- `memory_read` 旧调用仍可工作。
- system prompt 不再自动塞入 semantic/episodic topK。
- Instruction memory 注入有数量或 token budget 限制。
- Tool 结果返回 scoreBreakdown。
- Qdrant 不可用时 fallback 可用且 recoverable。

## 验证命令

```bash
pnpm --filter @notion/web typecheck
pnpm --filter @notion/web lint
pnpm --filter @notion/web build
pnpm ci:ai-smoke
```

如果新增 `packages/ai` 测试：

```bash
pnpm test
```

## 风险

- 移除读路径 upsert 后，如果历史 memory 没有索引，会更多走 fallback；需要 M23/M24 同步状态支撑后续修复。
- 自动注入减少后，Agent 可能短期少引用部分语义记忆；应通过 `memory_search` tool 和 prompt 描述弥补。
- scoreBreakdown 先做轻量版，避免在 M24 中引入复杂 rerank。

## 与下一阶段衔接

M24 完成后进入 M25：

- M25 的 `memory_propose` / Inbox 依赖 M24 的 `memory_search` 做重复与冲突预检查。
- M25 的 Tool 卡片可利用 M24 的 evidence 和 score 信息做更可信的确认提示。

