import { describe, expect, it, vi } from "vitest";

const vectorStore = {
  upsertAgentMemory: vi.fn(),
  semanticSearchAgentMemories: vi.fn(),
};

vi.mock("../server/vector-store-cache", () => ({
  getOrCreateVectorStore: vi.fn(async () => vectorStore),
}));

import { fallbackRankMemories, retrieveRelevantMemories } from "../server/memory";

describe("agent memory retrieval", () => {
  it("retrieveRelevantMemories 只读查询向量索引，不在读路径 upsert", async () => {
    vectorStore.upsertAgentMemory.mockClear();
    vectorStore.semanticSearchAgentMemories.mockResolvedValue([{ memoryId: "m1", score: 0.9 }]);

    const result = await retrieveRelevantMemories({
      userId: "user-1",
      query: "中文偏好",
      topK: 3,
      memories: [
        {
          id: "m1",
          type: "preference",
          content: "用户偏好中文沟通",
          confidence: 1,
          updatedAt: Date.now(),
        },
      ],
    });

    expect(vectorStore.upsertAgentMemory).not.toHaveBeenCalled();
    expect(vectorStore.semanticSearchAgentMemories).toHaveBeenCalledWith("中文偏好", ["m1"], 3);
    expect(result.retrieval).toBe("semantic");
    expect(result.memories[0]).toMatchObject({
      id: "m1",
      matchScore: expect.any(Number),
    });
  });

  it("fallbackRankMemories 输出基础匹配分", () => {
    const [memory] = fallbackRankMemories(
      "中文偏好",
      [{
        id: "m1",
        type: "preference",
        content: "用户偏好中文沟通",
        confidence: 1,
      }],
      3,
    );

    expect(memory?.matchScore).toBeGreaterThan(0);
  });
});
