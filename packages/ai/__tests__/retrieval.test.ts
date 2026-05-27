import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/vector-store-cache", () => ({
  getOrCreateVectorStore: vi.fn(),
}));

import { getOrCreateVectorStore } from "../server/vector-store-cache";
import { retrieveKnowledge } from "../server/retrieval";
import { fuseCandidates } from "../server/retrieval/fusion";
import type { RetrievalCandidate } from "../server/retrieval";

describe("fuseCandidates", () => {
  it("合并同一个 chunk 的多路召回来源", () => {
    const candidates: RetrievalCandidate[] = [
      createCandidate({ source: "semantic", rank: 1, score: 0.9 }),
      createCandidate({ source: "keyword", rank: 1, score: 2.5 }),
    ];

    const result = fuseCandidates({ candidates, topK: 3 });

    expect(result).toHaveLength(1);
    expect(result[0].sources.sort()).toEqual(["keyword", "semantic"]);
    expect(result[0].metadata.sourceScores).toEqual({
      semantic: 0.9,
      keyword: 2.5,
    });
  });

  it("按融合分数排序并限制 topK", () => {
    const candidates: RetrievalCandidate[] = [
      createCandidate({ documentId: "d1", chunkId: "d1:0", source: "semantic", rank: 10 }),
      createCandidate({ documentId: "d2", chunkId: "d2:0", source: "keyword", rank: 1 }),
      createCandidate({ documentId: "d3", chunkId: "d3:0", source: "metadata", rank: 2 }),
    ];

    const result = fuseCandidates({ candidates, topK: 2 });

    expect(result).toHaveLength(2);
    expect(result[0].documentId).toBe("d2");
  });
});

describe("retrieveKnowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("空 query 返回空结果", async () => {
    const result = await retrieveKnowledge({ userId: "user-1", query: " " });

    expect(result.items).toEqual([]);
    expect(result.strategy).toBe("balanced");
    expect(getOrCreateVectorStore).not.toHaveBeenCalled();
  });

  it("fast 只执行语义召回", async () => {
    const vectorStore = createVectorStoreMock({
      semantic: [
        {
          document: { pageContent: "semantic content", metadata: { documentId: "d1", title: "Doc" } },
          score: 0.91,
        },
      ],
    });
    vi.mocked(getOrCreateVectorStore).mockResolvedValue(vectorStore);

    const result = await retrieveKnowledge({
      userId: "user-1",
      query: "requestId",
      strategy: "fast",
    });

    expect(result.strategy).toBe("fast");
    expect(result.metadata.semanticCount).toBe(1);
    expect(result.metadata.keywordCount).toBe(0);
    expect(vectorStore.semanticSearch).toHaveBeenCalledTimes(1);
    expect(vectorStore.keywordSearch).not.toHaveBeenCalled();
    expect(vectorStore.metadataSearch).not.toHaveBeenCalled();
  });

  it("balanced 执行 semantic、keyword、metadata 并融合去重", async () => {
    const vectorStore = createVectorStoreMock({
      semantic: [
        {
          document: {
            pageContent: "requestId from semantic",
            metadata: { documentId: "d1", title: "API Contract", chunkIndex: 0 },
          },
          score: 0.91,
        },
      ],
      keyword: [
        {
          document: {
            pageContent: "requestId from keyword",
            metadata: { documentId: "d1", title: "API Contract", chunkIndex: 0 },
          },
          score: 2,
        },
      ],
      metadata: [
        {
          document: {
            pageContent: "rate limit doc",
            metadata: { documentId: "d2", title: "Rate Limit", chunkIndex: 0 },
          },
          score: 1,
        },
      ],
    });
    vi.mocked(getOrCreateVectorStore).mockResolvedValue(vectorStore);

    const result = await retrieveKnowledge({
      userId: "user-1",
      query: "requestId",
      strategy: "balanced",
      topK: 3,
    });

    expect(result.strategy).toBe("balanced");
    expect(result.metadata).toMatchObject({
      semanticCount: 1,
      keywordCount: 1,
      metadataCount: 1,
      fusedCount: 2,
    });
    expect(result.items[0].sources).toContain("semantic");
    expect(result.items[0].sources).toContain("keyword");
    expect(vectorStore.semanticSearch).toHaveBeenCalledWith("requestId", 9, 0.6, {
      includeDocumentIds: undefined,
    });
    expect(vectorStore.keywordSearch).toHaveBeenCalledWith("requestId", 9, {
      documentIds: undefined,
    });
    expect(vectorStore.metadataSearch).toHaveBeenCalledWith("requestId", 3, {
      documentIds: undefined,
      updatedAfter: undefined,
    });
  });

  it("将 documentIds 过滤传给三路召回", async () => {
    const vectorStore = createVectorStoreMock({});
    vi.mocked(getOrCreateVectorStore).mockResolvedValue(vectorStore);

    await retrieveKnowledge({
      userId: "user-1",
      query: "requestId",
      strategy: "balanced",
      topK: 2,
      filters: { documentIds: ["doc-1"] },
    });

    expect(vectorStore.semanticSearch).toHaveBeenCalledWith("requestId", 6, 0.6, {
      includeDocumentIds: ["doc-1"],
    });
    expect(vectorStore.keywordSearch).toHaveBeenCalledWith("requestId", 6, {
      documentIds: ["doc-1"],
    });
    expect(vectorStore.metadataSearch).toHaveBeenCalledWith("requestId", 2, {
      documentIds: ["doc-1"],
      updatedAfter: undefined,
    });
  });
});

function createCandidate(
  overrides: Partial<RetrievalCandidate> = {},
): RetrievalCandidate {
  return {
    documentId: "d1",
    chunkId: "d1:0",
    chunkIndex: 0,
    title: "Doc",
    content: "content",
    score: 1,
    source: "semantic",
    rank: 1,
    metadata: {},
    ...overrides,
  };
}

function createVectorStoreMock(results: {
  semantic?: Array<{ document: { pageContent: string; metadata: Record<string, unknown> }; score: number }>;
  keyword?: Array<{ document: { pageContent: string; metadata: Record<string, unknown> }; score: number }>;
  metadata?: Array<{ document: { pageContent: string; metadata: Record<string, unknown> }; score: number }>;
}) {
  return {
    semanticSearch: vi.fn().mockResolvedValue(results.semantic ?? []),
    similaritySearch: vi.fn().mockResolvedValue(results.semantic ?? []),
    keywordSearch: vi.fn().mockResolvedValue(results.keyword ?? []),
    metadataSearch: vi.fn().mockResolvedValue(results.metadata ?? []),
  } as any;
}
