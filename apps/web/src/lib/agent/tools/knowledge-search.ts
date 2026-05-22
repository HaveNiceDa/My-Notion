import { getOrCreateVectorStore } from "@notion/ai/server";
import type { PendingToolCall } from "./types";

const KNOWLEDGE_SEARCH_SIGNALS = [
  "知识库",
  "文档",
  "笔记",
  "页面",
  "资料",
  "根据",
  "查找",
  "搜索",
  "总结",
  "之前",
  "项目",
  "notion",
  "knowledge",
  "document",
  "docs",
  "note",
  "page",
  "according to",
  "based on",
  "summarize",
  "search",
];

export function shouldUseKnowledgeSearch(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  return KNOWLEDGE_SEARCH_SIGNALS.some((signal) => normalizedQuery.includes(signal));
}

export function createKnowledgeSearchToolCall(query: string, topK = 3): PendingToolCall {
  return {
    id: `knowledge-search-${Date.now()}`,
    type: "function",
    function: {
      name: "knowledge_search",
      arguments: JSON.stringify({ query, topK }),
    },
  };
}

export async function executeKnowledgeSearch(
  userId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return { query, documents: [], error: "query is required" };
  }

  const topK = typeof args.topK === "number" ? Math.min(Math.max(args.topK, 1), 8) : 3;
  try {
    const vectorStore = await getOrCreateVectorStore(userId);
    const results = await vectorStore.similaritySearch(query, topK, 0.6);

    return {
      query,
      documents: results.map((result) => ({
        documentId: result.document.metadata?.documentId ?? "",
        title: result.document.metadata?.title ?? "",
        score: Number(result.score.toFixed(4)),
        content: result.document.pageContent,
      })),
    };
  } catch (error) {
    return {
      query,
      documents: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
