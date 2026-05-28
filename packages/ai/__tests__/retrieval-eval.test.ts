import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/vector-store-cache", () => ({
  getOrCreateVectorStore: vi.fn(),
}));

import { getOrCreateVectorStore } from "../server/vector-store-cache";
import { retrieveKnowledge } from "../server/retrieval";
import type { KnowledgeRetrievalResult } from "../server/retrieval";

interface EvalDoc {
  documentId: string;
  title: string;
  chunkIndex: number;
  content: string;
  semanticScore?: number;
  keywordScore?: number;
  metadataScore?: number;
}

interface RetrievalEvalCase {
  id: string;
  query: string;
  topK: number;
  contextTokenBudget?: number;
  corpus: EvalDoc[];
  expected: {
    documentIds: string[];
    minCitationCoverage: number;
    minUniqueDocuments: number;
    maxPackedCount?: number;
    needsMoreRetrieval: boolean;
    contextTruncated?: boolean;
    mergedItemCountAtLeast?: number;
    requiredSources?: Array<"semantic" | "keyword" | "metadata">;
  };
}

const EVAL_CASES: RetrievalEvalCase[] = [
  {
    id: "hybrid-api-contract",
    query: "requestId 限流策略",
    topK: 4,
    corpus: [
      doc("api", "API Contract", 0, "requestId 必须由客户端传入，用于链路追踪。", {
        semanticScore: 0.92,
        keywordScore: 3,
      }),
      doc("api", "API Contract", 1, "限流策略使用滑动窗口，默认每用户每分钟 20 次。", {
        semanticScore: 0.88,
        keywordScore: 2.8,
      }),
      doc("memory", "Memory Policy", 0, "memory_read 读取长期记忆，不参与 API 限流。", {
        keywordScore: 1.2,
      }),
    ],
    expected: {
      documentIds: ["api"],
      minCitationCoverage: 1,
      minUniqueDocuments: 1,
      maxPackedCount: 2,
      needsMoreRetrieval: false,
      mergedItemCountAtLeast: 1,
      requiredSources: ["semantic", "keyword"],
    },
  },
  {
    id: "metadata-recency",
    query: "最近更新的 Memory Qdrant 同步状态",
    topK: 3,
    corpus: [
      doc("memory", "Memory Qdrant Sync", 0, "写入、编辑、停用 memory 后会显式同步 Qdrant。", {
        semanticScore: 0.9,
        metadataScore: 2.5,
      }),
      doc("memory", "Memory Qdrant Sync", 1, "同步失败时 warning 降级，后续需要状态可视化和重试队列。", {
        semanticScore: 0.84,
        metadataScore: 2.2,
      }),
      doc("rag", "RAG Packing", 0, "Context Packing 负责合并相邻 chunk。", {
        semanticScore: 0.7,
      }),
    ],
    expected: {
      documentIds: ["memory"],
      minCitationCoverage: 1,
      minUniqueDocuments: 1,
      maxPackedCount: 2,
      needsMoreRetrieval: false,
      mergedItemCountAtLeast: 1,
      requiredSources: ["semantic", "metadata"],
    },
  },
  {
    id: "token-budget-truncation",
    query: "完整解释 RAG context packing 的长文档",
    topK: 3,
    contextTokenBudget: 60,
    corpus: [
      doc("rag-long", "RAG Context Packing", 0, "Context Packing ".repeat(80), {
        semanticScore: 0.95,
        keywordScore: 2,
      }),
      doc("rag-long", "RAG Context Packing", 1, "Citation Quality ".repeat(80), {
        semanticScore: 0.9,
        keywordScore: 1.8,
      }),
      doc("trace", "Agent Trace", 0, "Agent Trace 记录工具调用耗时。", {
        semanticScore: 0.65,
      }),
    ],
    expected: {
      documentIds: ["rag-long"],
      minCitationCoverage: 1,
      minUniqueDocuments: 1,
      maxPackedCount: 1,
      needsMoreRetrieval: true,
      contextTruncated: true,
      mergedItemCountAtLeast: 1,
      requiredSources: ["semantic", "keyword"],
    },
  },
];

describe("retrieval eval golden set", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_API_KEY;
  });

  it.each(EVAL_CASES)("$id", async (evalCase) => {
    vi.mocked(getOrCreateVectorStore).mockResolvedValue(createEvalVectorStore(evalCase.corpus));

    const result = await retrieveKnowledge({
      userId: "eval-user",
      query: evalCase.query,
      strategy: "balanced",
      topK: evalCase.topK,
      contextTokenBudget: evalCase.contextTokenBudget,
    });

    expectRetrievalEval(result, evalCase);
  });
});

function expectRetrievalEval(result: KnowledgeRetrievalResult, evalCase: RetrievalEvalCase) {
  const quality = result.metadata.citationQuality;
  expect(quality).toBeTruthy();
  if (!quality) return;

  for (const documentId of evalCase.expected.documentIds) {
    expect(result.items.some((item) => item.documentId === documentId)).toBe(true);
  }

  expect(quality.citationCoverage).toBeGreaterThanOrEqual(evalCase.expected.minCitationCoverage);
  expect(quality.uniqueDocumentCount).toBeGreaterThanOrEqual(evalCase.expected.minUniqueDocuments);
  expect(quality.needsMoreRetrieval).toBe(evalCase.expected.needsMoreRetrieval);

  if (evalCase.expected.maxPackedCount !== undefined) {
    expect(result.metadata.packedCount).toBeLessThanOrEqual(evalCase.expected.maxPackedCount);
  }
  if (evalCase.expected.contextTruncated !== undefined) {
    expect(result.metadata.contextTruncated).toBe(evalCase.expected.contextTruncated);
  }
  if (evalCase.expected.mergedItemCountAtLeast !== undefined) {
    expect(quality.packing.mergedItemCount).toBeGreaterThanOrEqual(
      evalCase.expected.mergedItemCountAtLeast,
    );
  }

  for (const source of evalCase.expected.requiredSources ?? []) {
    expect(quality.sourceCoverage[source]).toBeGreaterThan(0);
  }
}

function createEvalVectorStore(corpus: EvalDoc[]) {
  return {
    semanticSearch: vi.fn().mockImplementation((_query, topK: number) =>
      Promise.resolve(toResults(corpus, "semanticScore", topK)),
    ),
    similaritySearch: vi.fn().mockImplementation((_query, topK: number) =>
      Promise.resolve(toResults(corpus, "semanticScore", topK)),
    ),
    keywordSearch: vi.fn().mockImplementation((_query, topK: number) =>
      Promise.resolve(toResults(corpus, "keywordScore", topK)),
    ),
    metadataSearch: vi.fn().mockImplementation((_query, topK: number) =>
      Promise.resolve(toResults(corpus, "metadataScore", topK)),
    ),
  } as any;
}

function toResults(
  corpus: EvalDoc[],
  scoreKey: "semanticScore" | "keywordScore" | "metadataScore",
  topK: number,
) {
  return corpus
    .filter((item) => typeof item[scoreKey] === "number")
    .sort((a, b) => (b[scoreKey] ?? 0) - (a[scoreKey] ?? 0))
    .slice(0, topK)
    .map((item) => ({
      document: {
        pageContent: item.content,
        metadata: {
          documentId: item.documentId,
          title: item.title,
          chunkIndex: item.chunkIndex,
        },
      },
      score: item[scoreKey] ?? 0,
    }));
}

function doc(
  documentId: string,
  title: string,
  chunkIndex: number,
  content: string,
  scores: Pick<EvalDoc, "semanticScore" | "keywordScore" | "metadataScore">,
): EvalDoc {
  return {
    documentId,
    title,
    chunkIndex,
    content,
    ...scores,
  };
}
