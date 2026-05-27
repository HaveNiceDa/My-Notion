import { describe, it, expect, vi } from "vitest";

vi.mock("@notion/ai/server", () => ({
  getOrCreateVectorStore: vi.fn(),
  retrieveKnowledge: vi.fn(),
}));

vi.mock("@notion/ai/utils", () => ({
  extractTextFromDocument: vi.fn(),
}));

vi.mock("serpapi", () => ({
  getJson: vi.fn(),
}));

import { buildAvailableTools } from "../tools/registry";
import { knowledgeSearchTool, documentReadTool, webSearchTool } from "../tools/definitions";
import { executeKnowledgeSearch } from "../tools/knowledge-search";
import { executeWebSearch } from "../tools/web-search";
import { retrieveKnowledge } from "@notion/ai/server";
import { getJson } from "serpapi";

describe("buildAvailableTools", () => {
  it("始终包含 knowledge_search 和 web_search", () => {
    const tools = buildAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("knowledge_search");
    expect(names).toContain("web_search");
  });

  it("无当前文档时不包含 document_read", () => {
    const tools = buildAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("document_read");
  });

  it("有当前文档时包含 document_read", () => {
    const tools = buildAvailableTools({ id: "doc-1", title: "Test" });
    const names = tools.map((t) => t.name);
    expect(names).toContain("document_read");
  });

  it("文档 id 为空字符串时不包含 document_read", () => {
    const tools = buildAvailableTools({ id: "", title: "Test" });
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("document_read");
  });
});

describe("AgentTool 定义", () => {
  it("knowledgeSearchTool 有正确的 name 和 parameters", () => {
    expect(knowledgeSearchTool.name).toBe("knowledge_search");
    expect(knowledgeSearchTool.parameters).toHaveProperty("properties");
    expect(knowledgeSearchTool.parameters.required).toContain("query");
  });

  it("documentReadTool 无必填参数", () => {
    expect(documentReadTool.name).toBe("document_read");
    expect(documentReadTool.parameters.required).toBeUndefined();
  });

  it("webSearchTool 有 query 必填参数", () => {
    expect(webSearchTool.name).toBe("web_search");
    expect(webSearchTool.parameters.required).toContain("query");
  });

  it("每个 tool 都有非空 description", () => {
    for (const tool of [knowledgeSearchTool, documentReadTool, webSearchTool]) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe("executeKnowledgeSearch", () => {
  it("空 query 返回错误", async () => {
    const result = await executeKnowledgeSearch("user-1", { query: "" });
    expect(result).toEqual({ query: "", documents: [], error: "query is required" });
  });

  it("非字符串 query 返回错误", async () => {
    const result = await executeKnowledgeSearch("user-1", { query: 123 });
    expect(result).toEqual({ query: "", documents: [], error: "query is required" });
  });

  it("正常搜索返回结果", async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue({
      query: "test",
      strategy: "balanced",
      items: [
        { documentId: "d1", chunkId: "d1:0", title: "Doc1", score: 0.95, content: "Content1", sources: ["semantic"], metadata: {} },
        { documentId: "d2", chunkId: "d2:0", title: "Doc2", score: 0.85, content: "Content2", sources: ["keyword"], metadata: {} },
      ],
      metadata: { semanticCount: 1, keywordCount: 1, metadataCount: 0, fusedCount: 2 },
    });

    const result = await executeKnowledgeSearch("user-1", { query: "test" }) as any;
    expect(result.query).toBe("test");
    expect(result.strategy).toBe("balanced");
    expect(result.documents.length).toBe(2);
    expect(result.documents[0].documentId).toBe("d1");
    expect(result.documents[0].score).toBe(0.95);
    expect(result.documents[0].sources).toEqual(["semantic"]);
    expect(retrieveKnowledge).toHaveBeenCalledWith({
      userId: "user-1",
      query: "test",
      topK: 3,
      strategy: "balanced",
    });
  });

  it("topK 被限制在 1-8 范围内", async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue({
      query: "test",
      strategy: "balanced",
      items: [],
      metadata: { semanticCount: 0, keywordCount: 0, metadataCount: 0, fusedCount: 0 },
    });

    await executeKnowledgeSearch("user-1", { query: "test", topK: 20 });
    expect(retrieveKnowledge).toHaveBeenLastCalledWith({
      userId: "user-1",
      query: "test",
      topK: 8,
      strategy: "balanced",
    });

    await executeKnowledgeSearch("user-1", { query: "test", topK: -1 });
    expect(retrieveKnowledge).toHaveBeenLastCalledWith({
      userId: "user-1",
      query: "test",
      topK: 1,
      strategy: "balanced",
    });
  });

  it("topK 默认为 3", async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue({
      query: "test",
      strategy: "balanced",
      items: [],
      metadata: { semanticCount: 0, keywordCount: 0, metadataCount: 0, fusedCount: 0 },
    });

    await executeKnowledgeSearch("user-1", { query: "test" });
    expect(retrieveKnowledge).toHaveBeenCalledWith({
      userId: "user-1",
      query: "test",
      topK: 3,
      strategy: "balanced",
    });
  });

  it("支持传入检索策略", async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue({
      query: "test",
      strategy: "fast",
      items: [],
      metadata: { semanticCount: 0, keywordCount: 0, metadataCount: 0, fusedCount: 0 },
    });

    await executeKnowledgeSearch("user-1", { query: "test", strategy: "fast" });
    expect(retrieveKnowledge).toHaveBeenCalledWith({
      userId: "user-1",
      query: "test",
      topK: 3,
      strategy: "fast",
    });
  });

  it("搜索异常时返回错误", async () => {
    vi.mocked(retrieveKnowledge).mockRejectedValue(new Error("DB error"));

    const result = await executeKnowledgeSearch("user-1", { query: "test" }) as any;
    expect(result.documents).toEqual([]);
    expect(result.error).toBe("DB error");
  });

  it("metadata 缺失时使用默认值", async () => {
    vi.mocked(retrieveKnowledge).mockResolvedValue({
      query: "test",
      strategy: "balanced",
      items: [
        { documentId: "", chunkId: "unknown:0", title: "", score: 0.9, content: "Content", sources: ["semantic"], metadata: {} },
      ],
      metadata: { semanticCount: 1, keywordCount: 0, metadataCount: 0, fusedCount: 1 },
    });

    const result = await executeKnowledgeSearch("user-1", { query: "test" }) as any;
    expect(result.documents[0].documentId).toBe("");
    expect(result.documents[0].title).toBe("");
  });
});

describe("executeWebSearch", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("空 query 返回错误", async () => {
    const result = await executeWebSearch({ query: "" }, baseCtx);
    expect(result).toEqual({ query: "", results: [], error: "query is required" });
  });

  it("非字符串 query 返回错误", async () => {
    const result = await executeWebSearch({ query: null }, baseCtx);
    expect(result).toEqual({ query: "", results: [], error: "query is required" });
  });

  it("SERPAPI_API_KEY 未配置时返回错误", async () => {
    const originalKey = process.env.SERPAPI_API_KEY;
    delete process.env.SERPAPI_API_KEY;

    const result = await executeWebSearch({ query: "test" }, baseCtx) as any;
    expect(result.error).toBe("SERPAPI_API_KEY is not configured");
    expect(result.results).toEqual([]);

    if (originalKey) process.env.SERPAPI_API_KEY = originalKey;
  });

  it("正常搜索返回结构化结果", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    vi.mocked(getJson).mockResolvedValue({
      organic_results: [
        { title: "Result 1", link: "https://a.com", snippet: "Snippet 1" },
        { title: "Result 2", link: "https://b.com", snippet: "Snippet 2" },
      ],
    });

    const result = await executeWebSearch({ query: "test" }, baseCtx) as any;
    expect(result.query).toBe("test");
    expect(result.results.length).toBe(2);
    expect(result.results[0]).toEqual({
      title: "Result 1",
      link: "https://a.com",
      snippet: "Snippet 1",
    });
  });

  it("搜索结果最多返回 5 条", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    const manyResults = Array.from({ length: 10 }, (_, i) => ({
      title: `Result ${i + 1}`,
      link: `https://${i}.com`,
      snippet: `Snippet ${i + 1}`,
    }));
    vi.mocked(getJson).mockResolvedValue({ organic_results: manyResults });

    const result = await executeWebSearch({ query: "test" }, baseCtx) as any;
    expect(result.results.length).toBe(5);
  });

  it("organic_results 为空时返回空数组", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    vi.mocked(getJson).mockResolvedValue({});

    const result = await executeWebSearch({ query: "test" }, baseCtx) as any;
    expect(result.results).toEqual([]);
  });

  it("搜索异常时返回错误", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    vi.mocked(getJson).mockRejectedValue(new Error("Network error"));

    const result = await executeWebSearch({ query: "test" }, baseCtx) as any;
    expect(result.results).toEqual([]);
    expect(result.error).toBe("Network error");
  });

  it("有 stream 上下文时推送 tool-result-delta", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    vi.mocked(getJson).mockResolvedValue({
      organic_results: [
        { title: "T1", link: "https://a.com", snippet: "S1" },
      ],
    });

    const chunks: Uint8Array[] = [];
    const ctx = {
      ...baseCtx,
      stream: {
        controller: { enqueue: (c: Uint8Array) => chunks.push(c) } as any,
        encoder: new TextEncoder(),
        toolCallId: "tc-1",
      },
    };

    await executeWebSearch({ query: "test" }, ctx);
    expect(chunks.length).toBe(1);
    const parsed = JSON.parse(new TextDecoder().decode(chunks[0]).trim());
    expect(parsed.type).toBe("tool-result-delta");
    expect(parsed.toolCallId).toBe("tc-1");
    expect(parsed.delta).toContain("T1");
  });

  it("无搜索结果时不推送 stream 事件", async () => {
    process.env.SERPAPI_API_KEY = "test-key";
    vi.mocked(getJson).mockResolvedValue({});

    const chunks: Uint8Array[] = [];
    const ctx = {
      ...baseCtx,
      stream: {
        controller: { enqueue: (c: Uint8Array) => chunks.push(c) } as any,
        encoder: new TextEncoder(),
        toolCallId: "tc-2",
      },
    };

    await executeWebSearch({ query: "test" }, ctx);
    expect(chunks.length).toBe(0);
  });
});
