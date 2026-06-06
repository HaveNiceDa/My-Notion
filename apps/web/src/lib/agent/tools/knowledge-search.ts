import { retrieveKnowledge, type RetrievalStrategy } from "@notion/ai/server";
import { buildToolErrorResult, withToolResultContract } from "./result-contract";

// 知识库检索：搜索用户个人知识库中的文档和笔记
export async function executeKnowledgeSearch(
  userId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return {
      query,
      documents: [],
      ...buildToolErrorResult("knowledge_search", "query is required", { reason: "validation_error" }),
    };
  }

  const topK = typeof args.topK === "number" ? Math.min(Math.max(args.topK, 1), 8) : 3;
  const strategy = parseRetrievalStrategy(args.strategy);
  try {
    const result = await retrieveKnowledge({
      userId,
      query,
      topK,
      strategy,
    });

    const documents = result.items.map((item) => ({
      documentId: item.documentId,
      title: item.title,
      score: item.score,
      content: item.content,
      sources: item.sources,
      metadata: item.metadata,
    }));

    return withToolResultContract("knowledge_search", {
      query,
      strategy: result.strategy,
      documents,
    }, {
      summary: `Found ${documents.length} knowledge document(s) for "${query}".`,
      sources: documents.map((item) => ({
        type: "document",
        title: item.title,
        documentId: item.documentId,
        score: item.score,
      })),
      metadata: result.metadata,
    });
  } catch (error) {
    return {
      query,
      strategy,
      documents: [],
      ...buildToolErrorResult("knowledge_search", error),
    };
  }
}

function parseRetrievalStrategy(value: unknown): RetrievalStrategy {
  if (value === "fast" || value === "balanced" || value === "deep") {
    return value;
  }

  return "balanced";
}
