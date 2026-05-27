import { describe, expect, it, vi } from "vitest";

import { QdrantVectorStoreWrapper } from "../rag";

describe("QdrantVectorStoreWrapper metadataSearch", () => {
  it("按标签、层级标题和邻近摘要计算 metadata 召回分数", async () => {
    const originalQdrantUrl = process.env.NEXT_PUBLIC_QDRANT_URL;
    process.env.NEXT_PUBLIC_QDRANT_URL = "http://localhost:6333";

    const store = new QdrantVectorStoreWrapper("user-1", {
      embedQuery: vi.fn(),
      embedDocuments: vi.fn(),
    } as any);

    (store as any).qdrantClient = {
      getCollections: vi.fn().mockResolvedValue({
        collections: [{ name: "user_user-1_knowledge_base" }],
      }),
      createPayloadIndex: vi.fn().mockResolvedValue(undefined),
      scroll: vi.fn().mockResolvedValue({
        points: [
          {
            payload: {
              pageContent: "Hybrid retrieval implementation",
              metadata: {
                documentId: "doc-1",
                title: "Agent Search",
                tags: ["rag", "agent"],
                headings: ["Hybrid Retrieval"],
                headingPath: "Agent > Hybrid Retrieval",
                neighborSummary: "前文: keyword recall\n后文: metadata recall",
                updatedAt: Date.now(),
              },
            },
          },
          {
            payload: {
              pageContent: "Unrelated content",
              metadata: {
                documentId: "doc-2",
                title: "Other",
                tags: ["misc"],
                headings: [],
                headingPath: "",
              },
            },
          },
        ],
      }),
    };

    const results = await store.metadataSearch("hybrid rag metadata", 3);

    expect(results).toHaveLength(1);
    expect(results[0].document.metadata.documentId).toBe("doc-1");
    expect(results[0].score).toBeGreaterThan(0);

    if (originalQdrantUrl) {
      process.env.NEXT_PUBLIC_QDRANT_URL = originalQdrantUrl;
    } else {
      delete process.env.NEXT_PUBLIC_QDRANT_URL;
    }
  });
});
