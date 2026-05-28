import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../server/vector-store-cache", () => ({
  getOrCreateVectorStore: vi.fn(),
}));

import { getOrCreateVectorStore } from "../server/vector-store-cache";
import { retrieveKnowledge } from "../server/retrieval";
import { buildCitationQuality } from "../server/retrieval/citation-quality";
import { packRetrievalContext } from "../server/retrieval/context-packing";
import { fuseCandidates } from "../server/retrieval/fusion";
import type { RetrievalCandidate, RetrievalResultItem } from "../server/retrieval";

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

describe("packRetrievalContext", () => {
  it("按文档合并相邻 chunk", () => {
    const result = packRetrievalContext({
      items: [
        createResultItem({ chunkId: "d1:0", chunkIndex: 0, content: "第一段", score: 0.9 }),
        createResultItem({ chunkId: "d1:1", chunkIndex: 1, content: "第二段", score: 0.8 }),
        createResultItem({ chunkId: "d1:3", chunkIndex: 3, content: "第四段", score: 0.7 }),
      ],
      tokenBudget: 100,
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      documentId: "d1",
      chunkId: "d1:0-1",
      chunkIndex: 0,
      content: "第一段\n\n第二段",
    });
    expect(result.items[0].metadata.packedChunkIds).toEqual(["d1:0", "d1:1"]);
    expect(result.metadata.packedCount).toBe(2);
    expect(result.metadata.contextTruncated).toBe(false);
  });

  it("按 token budget 裁剪上下文", () => {
    const result = packRetrievalContext({
      items: [
        createResultItem({
          chunkId: "d1:0",
          chunkIndex: 0,
          content: "a".repeat(400),
          score: 0.9,
        }),
        createResultItem({
          documentId: "d2",
          chunkId: "d2:0",
          chunkIndex: 0,
          content: "b".repeat(400),
          score: 0.8,
        }),
      ],
      tokenBudget: 50,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toContain("[truncated]");
    expect(result.items[0].metadata.truncatedByTokenBudget).toBe(true);
    expect(result.metadata.contextTruncated).toBe(true);
    expect(result.metadata.contextEstimatedTokens).toBeLessThanOrEqual(55);
  });
});

describe("buildCitationQuality", () => {
  it("输出引用覆盖率、来源分数解释和 packing 说明", () => {
    const quality = buildCitationQuality({
      items: [
        createResultItem({
          documentId: "d1",
          title: "Doc",
          sources: ["semantic", "keyword"],
          metadata: {
            sourceScores: { semantic: 0.91, keyword: 2 },
            packedItemCount: 2,
            packedChunkIndexes: [0, 1],
          },
        }),
        createResultItem({
          documentId: "",
          title: "",
          sources: ["metadata"],
          metadata: { truncatedByTokenBudget: true },
        }),
      ],
      fusedCount: 3,
      packedCount: 2,
      contextTokenBudget: 100,
      contextEstimatedTokens: 80,
      contextTruncated: true,
    });

    expect(quality.citationCoverage).toBe(0.5);
    expect(quality.uniqueDocumentCount).toBe(1);
    expect(quality.sourceCoverage).toEqual({
      semantic: 0.5,
      keyword: 0.5,
      metadata: 0.5,
    });
    expect(quality.sourceScoreExplanations[0].sourceScores).toEqual([
      expect.objectContaining({ source: "semantic", score: 0.91 }),
      expect.objectContaining({ source: "keyword", score: 2 }),
    ]);
    expect(quality.packing).toMatchObject({
      fusedCount: 3,
      packedCount: 2,
      mergedItemCount: 1,
      contextTruncated: true,
    });
    expect(quality.needsMoreRetrieval).toBe(true);
  });
});

describe("retrieveKnowledge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LLM_API_KEY;
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
    expect(result.metadata.citationQuality).toMatchObject({
      citationCoverage: 1,
      uniqueDocumentCount: 2,
      needsMoreRetrieval: false,
    });
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

  it("balanced 对融合结果执行 context packing", async () => {
    const vectorStore = createVectorStoreMock({
      semantic: [
        {
          document: {
            pageContent: "chunk 0",
            metadata: { documentId: "d1", title: "Guide", chunkIndex: 0 },
          },
          score: 0.95,
        },
        {
          document: {
            pageContent: "chunk 1",
            metadata: { documentId: "d1", title: "Guide", chunkIndex: 1 },
          },
          score: 0.9,
        },
        {
          document: {
            pageContent: "chunk 3",
            metadata: { documentId: "d1", title: "Guide", chunkIndex: 3 },
          },
          score: 0.85,
        },
      ],
    });
    vi.mocked(getOrCreateVectorStore).mockResolvedValue(vectorStore);

    const result = await retrieveKnowledge({
      userId: "user-1",
      query: "guide",
      strategy: "balanced",
      topK: 3,
      contextTokenBudget: 100,
    });

    expect(result.metadata.fusedCount).toBe(3);
    expect(result.metadata.packedCount).toBe(2);
    expect(result.items[0].chunkId).toBe("d1:0-1");
    expect(result.items[0].content).toBe("chunk 0\n\nchunk 1");
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

  it("deep 执行 query rewrite 后进行 multi-query 混合检索", async () => {
    const vectorStore = createVectorStoreMock({
      semantic: [
        {
          document: {
            pageContent: "deep semantic content",
            metadata: { documentId: "d1", title: "Deep", chunkIndex: 0 },
          },
          score: 0.9,
        },
      ],
      keyword: [
        {
          document: {
            pageContent: "deep keyword content",
            metadata: { documentId: "d2", title: "Keyword", chunkIndex: 0 },
          },
          score: 2,
        },
      ],
    });
    vi.mocked(getOrCreateVectorStore).mockResolvedValue(vectorStore);

    const result = await retrieveKnowledge({
      userId: "user-1",
      query: "requestId 限流策略",
      strategy: "deep",
      topK: 3,
    });

    expect(result.strategy).toBe("deep");
    expect(result.metadata.queryVariants).toEqual([
      { kind: "original", query: "requestId 限流策略" },
      { kind: "keyword", query: "requestId 限流策略" },
      { kind: "semantic", query: "requestId 限流策略" },
    ]);
    expect(vectorStore.semanticSearch).toHaveBeenCalledTimes(3);
    expect(vectorStore.keywordSearch).toHaveBeenCalledTimes(3);
    expect(vectorStore.metadataSearch).toHaveBeenCalledTimes(3);
    expect(result.items[0].metadata.queryVariant).toBeTruthy();
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

function createResultItem(
  overrides: Partial<RetrievalResultItem> = {},
): RetrievalResultItem {
  return {
    documentId: "d1",
    chunkId: "d1:0",
    chunkIndex: 0,
    title: "Doc",
    content: "content",
    score: 1,
    sources: ["semantic"],
    metadata: { sourceScores: { semantic: 0.9 } },
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
