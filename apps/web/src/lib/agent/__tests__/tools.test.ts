import { describe, it, expect, vi } from "vitest";

vi.mock("@notion/ai/server", () => ({
  getOrCreateVectorStore: vi.fn(),
  retrieveKnowledge: vi.fn(),
  retrieveRelevantMemories: vi.fn(),
}));

vi.mock("@notion/ai/utils", () => ({
  extractTextFromDocument: vi.fn(),
}));

vi.mock("serpapi", () => ({
  getJson: vi.fn(),
}));

import { buildAvailableTools } from "../tools/registry";
import {
  knowledgeSearchTool,
  documentReadTool,
  documentUpdateTool,
  documentWriteTool,
  webSearchTool,
  memoryReadTool,
  memoryWriteTool,
} from "../tools/definitions";
import { executeKnowledgeSearch } from "../tools/knowledge-search";
import { executeDocumentUpdate, executeDocumentWrite } from "../tools/document-write";
import { executeWebSearch } from "../tools/web-search";
import { executeMemoryRead, executeMemoryWrite } from "../tools/memory";
import { retrieveKnowledge, retrieveRelevantMemories } from "@notion/ai/server";
import { getJson } from "serpapi";

describe("buildAvailableTools", () => {
  it("始终包含 knowledge_search 和 web_search", () => {
    const tools = buildAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("knowledge_search");
    expect(names).toContain("web_search");
    expect(names).toContain("memory_read");
    expect(names).toContain("memory_write");
    expect(names).toContain("document_write");
  });

  it("无当前文档时不包含 document_read", () => {
    const tools = buildAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("document_read");
    expect(names).not.toContain("document_update");
  });

  it("有当前文档时包含 document_read 和 document_update", () => {
    const tools = buildAvailableTools({ id: "doc-1", title: "Test" });
    const names = tools.map((t) => t.name);
    expect(names).toContain("document_read");
    expect(names).toContain("document_update");
  });

  it("文档 id 为空字符串时不包含 document_read", () => {
    const tools = buildAvailableTools({ id: "", title: "Test" });
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("document_read");
    expect(names).not.toContain("document_update");
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

  it("memoryWriteTool 默认要求 content", () => {
    expect(memoryWriteTool.name).toBe("memory_write");
    expect(memoryWriteTool.parameters.required).toContain("content");
  });

  it("document_write 和 document_update 使用 dry-run 写入契约", () => {
    expect(documentWriteTool.name).toBe("document_write");
    expect(documentWriteTool.parameters.required).toEqual(["title", "contentMarkdown"]);
    expect(documentUpdateTool.name).toBe("document_update");
    expect(documentUpdateTool.parameters).toHaveProperty("properties");
  });

  it("每个 tool 都有非空 description", () => {
    for (const tool of [
      knowledgeSearchTool,
      documentReadTool,
      webSearchTool,
      memoryReadTool,
      memoryWriteTool,
      documentWriteTool,
      documentUpdateTool,
    ]) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });
});

describe("Document write tools", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("document_write 默认只返回 dry-run 预览", async () => {
    const result = await executeDocumentWrite(
      { title: "会议纪要", contentMarkdown: "# Agenda\n- A" },
      baseCtx,
    ) as any;

    expect(result.dryRun).toBe(true);
    expect(result.confirmationRequired).toBe(true);
    expect(result.action).toBe("document_write");
    expect(result.document.title).toBe("会议纪要");
    expect(result.document.contentMarkdown).toContain("Agenda");
  });

  it("document_write 空标题或内容返回可恢复错误", async () => {
    await expect(executeDocumentWrite({ title: "", contentMarkdown: "x" }, baseCtx))
      .resolves.toMatchObject({ error: "title is required", recoverable: true });
    await expect(executeDocumentWrite({ title: "x", contentMarkdown: "" }, baseCtx))
      .resolves.toMatchObject({ error: "contentMarkdown is required", recoverable: true });
  });

  it("document_update 可从当前文档上下文补 documentId", async () => {
    const result = await executeDocumentUpdate(
      { contentMarkdown: "补充内容", mode: "append" },
      { ...baseCtx, currentDocument: { id: "doc-1", title: "当前文档" } },
    ) as any;

    expect(result.dryRun).toBe(true);
    expect(result.confirmationRequired).toBe(true);
    expect(result.action).toBe("document_update");
    expect(result.document.documentId).toBe("doc-1");
    expect(result.document.currentTitle).toBe("当前文档");
    expect(result.document.mode).toBe("append");
  });

  it("document_update 无 documentId 或无变更时返回可恢复错误", async () => {
    await expect(executeDocumentUpdate({ contentMarkdown: "x" }, baseCtx))
      .resolves.toMatchObject({ error: "documentId is required", recoverable: true });
    await expect(executeDocumentUpdate({ documentId: "doc-1" }, baseCtx))
      .resolves.toMatchObject({ error: "title or contentMarkdown is required", recoverable: true });
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

describe("Memory tools", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("memory_read 缺少 Convex client 时返回可恢复错误", async () => {
    const result = await executeMemoryRead({ query: "偏好" }, baseCtx) as any;
    expect(result.memories).toEqual([]);
    expect(result.recoverable).toBe(true);
  });

  it("memory_read 调用 Convex 查询并返回记忆", async () => {
    const query = vi.fn().mockResolvedValue([
      { id: "m1", type: "preference", content: "用户偏好中文", matchScore: 1 },
    ]);
    vi.mocked(retrieveRelevantMemories).mockResolvedValue({
      memories: [{ id: "m1", type: "preference", content: "用户偏好中文", matchScore: 0.8 }],
      retrieval: "semantic",
    });
    const result = await executeMemoryRead(
      { query: "中文", type: "preference", limit: 3 },
      { ...baseCtx, convex: { query } as any },
    ) as any;

    expect(query).toHaveBeenCalledWith(expect.anything(), {
      query: undefined,
      type: "preference",
      limit: 100,
    });
    expect(result.memories).toHaveLength(1);
    expect(result.metadata.count).toBe(1);
    expect(result.metadata.retrieval).toBe("semantic");
  });

  it("memory_write 默认 dry-run，不写入 Convex", async () => {
    const mutation = vi.fn();
    const result = await executeMemoryWrite(
      { content: "用户偏好中文", type: "preference" },
      { ...baseCtx, convex: { mutation } as any },
    ) as any;

    expect(result.dryRun).toBe(true);
    expect(result.confirmationRequired).toBe(true);
    expect(result.memory.content).toBe("用户偏好中文");
    expect(mutation).not.toHaveBeenCalled();
  });

  it("memory_write dryRun=false 时写入 Convex", async () => {
    const mutation = vi.fn().mockResolvedValue({
      id: "m1",
      type: "preference",
      content: "用户偏好中文",
    });
    const result = await executeMemoryWrite(
      {
        content: "用户偏好中文",
        type: "preference",
        source: "user_explicit",
        dryRun: false,
      },
      { ...baseCtx, convex: { mutation } as any },
    ) as any;

    expect(mutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      content: "用户偏好中文",
      type: "preference",
      source: "user_explicit",
    }));
    expect(result.dryRun).toBe(false);
    expect(result.memory.id).toBe("m1");
  });

  it("memory_write 空内容返回错误", async () => {
    const result = await executeMemoryWrite({ content: "   " }, baseCtx) as any;
    expect(result.error).toBe("content is required");
    expect(result.recoverable).toBe(true);
  });
});
