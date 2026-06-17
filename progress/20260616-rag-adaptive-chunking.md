# RAG Adaptive Chunking

## 做了什么

- 将 RAG 入库切分从单一固定大小 splitter 调整为自适应策略。
- BlockNote JSON 文档优先按标题层级和段落边界切分，chunk metadata 记录 `chunkStrategy`、`headingPath`、`headings` 和 `blockTypes`。
- 超长语义单元自动退回固定大小 + 重叠切分，纯文本或无法解析的内容也走固定兜底。
- Qdrant 入库使用新的结构化 chunk，同时保留邻近 chunk 摘要、tags、documentPath、updatedAt 等既有 metadata。

## 为什么这样做

- 旧策略固定 `chunkSize=250`、`chunkOverlap=40`，实现简单但容易在语义中间截断，尤其对有标题层级的 Notion 文档召回不稳定。
- 新策略对应“标题层级切割 + 语义边界切割 + 固定兜底”的组合：结构清晰的文档优先保留语义完整性，纯文本仍保持可控 chunk 大小。
- 代码 AST 级切分暂未接入，因为当前知识库主来源是 BlockNote/Notion 文档，不是代码仓库索引。

## 验证

```bash
pnpm exec vitest run packages/ai/__tests__/rag-splitter.test.ts packages/ai/__tests__/extract-text.test.ts packages/ai/__tests__/retrieval.test.ts packages/ai/__tests__/qdrant-metadata.test.ts
pnpm --filter @notion/ai typecheck
```

验证结果：

- 4 个测试文件通过，16 个测试用例通过。
- `@notion/ai` typecheck 通过。
