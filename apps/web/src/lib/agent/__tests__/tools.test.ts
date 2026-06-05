import { describe, it, expect, vi } from "vitest";

vi.mock("@notion/ai/server", () => ({
  getOrCreateVectorStore: vi.fn(),
  retrieveKnowledge: vi.fn(),
  retrieveRelevantMemories: vi.fn(),
  syncAgentMemory: vi.fn(),
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
  documentSearchTool,
  webExtractTool,
  webSearchTool,
  memorySearchTool,
  memoryWriteTool,
  myNotionMcpTool,
  taskPlanTool,
} from "../tools/definitions";
import { executeKnowledgeSearch } from "../tools/knowledge-search";
import { executeDocumentUpdate, executeDocumentWrite } from "../tools/document-write";
import { executeDocumentSearch } from "../tools/document-search";
import { executeWebExtract } from "../tools/web-extract";
import { executeWebSearch } from "../tools/web-search";
import { executeMemorySearch, executeMemoryWrite } from "../tools/memory";
import { executeTaskPlan } from "../tools/task-plan";
import { executeMyNotionMcpAdapter } from "../tools/mcp-adapter";
import { withToolFallback } from "../tools/fallback";
import { retrieveKnowledge, retrieveRelevantMemories, syncAgentMemory } from "@notion/ai/server";
import { getJson } from "serpapi";

describe("buildAvailableTools", () => {
  it("始终包含只读基础工具和写入预览工具", () => {
    const tools = buildAvailableTools();
    const names = tools.map((t) => t.name);
    expect(names).toContain("knowledge_search");
    expect(names).toContain("web_search");
    expect(names).toContain("web_extract");
    expect(names).toContain("document_search");
    expect(names).toContain("memory_search");
    expect(names).toContain("memory_write");
    expect(names).toContain("mcp_my_notion_call");
    expect(names).toContain("task_plan");
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

  it("webExtractTool 有 url 必填参数", () => {
    expect(webExtractTool.name).toBe("web_extract");
    expect(webExtractTool.parameters.required).toContain("url");
  });

  it("documentSearchTool 是可选 query 的元数据搜索工具", () => {
    expect(documentSearchTool.name).toBe("document_search");
    expect(documentSearchTool.parameters.required).toBeUndefined();
  });

  it("memoryWriteTool 默认要求 content", () => {
    expect(memoryWriteTool.name).toBe("memory_write");
    expect(memoryWriteTool.parameters.required).toContain("content");
  });

  it("memorySearchTool 使用 query 作为必填参数", () => {
    expect(memorySearchTool.name).toBe("memory_search");
    expect(memorySearchTool.parameters.required).toContain("query");
    expect(memorySearchTool.parameters).toHaveProperty("properties");
  });

  it("taskPlanTool 要求 objective 和 steps", () => {
    expect(taskPlanTool.name).toBe("task_plan");
    expect(taskPlanTool.parameters.required).toEqual(["objective", "steps"]);
  });

  it("myNotionMcpTool 只暴露受控 MCP 白名单入口", () => {
    expect(myNotionMcpTool.name).toBe("mcp_my_notion_call");
    expect(myNotionMcpTool.parameters.required).toEqual(["toolName"]);
    const properties = myNotionMcpTool.parameters.properties as Record<string, unknown>;
    expect(properties.toolName).toMatchObject({
      enum: [
        "my_notion_docs_search",
        "my_notion_docs_fetch",
        "my_notion_docs_create",
        "my_notion_docs_update",
      ],
    });
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
      webExtractTool,
      documentSearchTool,
      memorySearchTool,
      memoryWriteTool,
      myNotionMcpTool,
      taskPlanTool,
      documentWriteTool,
      documentUpdateTool,
    ]) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("tool execute 抛异常时统一返回可恢复错误", async () => {
    const execute = withToolFallback({
      name: "knowledge_search",
      execute: async () => {
        throw new Error("unexpected");
      },
    });
    const result = await execute(
      { query: "test" },
      { userId: "user-1", model: "test-model" },
    ) as any;

    expect(result).toMatchObject({
      error: "unexpected",
      recoverable: true,
      metadata: {
        toolName: "knowledge_search",
        reason: "execution_error",
      },
    });
    expect(result.summary).toContain("knowledge_search failed");
    expect(result.sources).toEqual([]);
  });
});

describe("My-Notion MCP adapter", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("拒绝非白名单 MCP 工具", async () => {
    const result = await executeMyNotionMcpAdapter(
      { toolName: "external_tool", input: {} },
      baseCtx,
    ) as any;
    expect(result).toMatchObject({
      adapter: "my-notion-mcp",
      recoverable: true,
    });
  });

  it("docs search 通过 Convex 元数据搜索执行", async () => {
    const query = vi.fn().mockResolvedValue({
      documents: [{ documentId: "doc-1", title: "Roadmap" }],
    });
    const result = await executeMyNotionMcpAdapter(
      { toolName: "my_notion_docs_search", input: { query: "roadmap", limit: 50 } },
      { ...baseCtx, convex: { query } as any },
    ) as any;

    expect(query).toHaveBeenCalledWith(expect.anything(), {
      query: "roadmap",
      limit: 30,
      includeArchived: false,
    });
    expect(result.documents[0]).toMatchObject({ id: "doc-1", title: "Roadmap" });
    expect(result.metadata).toMatchObject({ adapter: "my-notion-mcp", safety: "read_only" });
  });

  it("docs create 强制返回 document_write dry-run 预览", async () => {
    const result = await executeMyNotionMcpAdapter(
      {
        toolName: "my_notion_docs_create",
        input: { title: "计划", contentMarkdown: "# Plan", dryRun: false },
      },
      baseCtx,
    ) as any;

    expect(result).toMatchObject({
      action: "document_write",
      dryRun: true,
      confirmationRequired: true,
      adapter: "my-notion-mcp",
    });
    expect(result.metadata).toMatchObject({ safety: "dry_run_only" });
  });

  it("docs update 将 MCP id 映射为 document_update 预览", async () => {
    const result = await executeMyNotionMcpAdapter(
      {
        toolName: "my_notion_docs_update",
        input: { id: "doc-1", contentMarkdown: "补充", mode: "append", dryRun: false },
      },
      baseCtx,
    ) as any;

    expect(result).toMatchObject({
      action: "document_update",
      dryRun: true,
      confirmationRequired: true,
      document: {
        documentId: "doc-1",
        contentMarkdown: "补充",
        mode: "append",
      },
    });
  });
});

describe("Task plan tool", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("生成结构化步骤计划", async () => {
    const result = await executeTaskPlan(
      {
        objective: "补齐基础能力",
        steps: [
          { title: "修 typecheck", status: "completed" },
          { id: "plan", title: "实现 task_plan", description: "输出多步骤计划", status: "in_progress" },
          { title: "验证", status: "unknown" },
        ],
      },
      baseCtx,
    ) as any;

    expect(result.objective).toBe("补齐基础能力");
    expect(result.steps).toEqual([
      { id: "step-1", title: "修 typecheck", status: "completed" },
      { id: "plan", title: "实现 task_plan", description: "输出多步骤计划", status: "in_progress" },
      { id: "step-3", title: "验证", status: "pending" },
    ]);
    expect(result.metadata).toMatchObject({
      stepCount: 3,
      currentStepId: "plan",
      completedCount: 1,
      blockedCount: 0,
    });
  });

  it("缺少目标或步骤时返回可恢复错误", async () => {
    await expect(executeTaskPlan({ objective: "", steps: [{ title: "x" }] }, baseCtx))
      .resolves.toMatchObject({ error: "objective is required", recoverable: true });
    await expect(executeTaskPlan({ objective: "x", steps: [] }, baseCtx))
      .resolves.toMatchObject({ error: "steps must contain at least one item", recoverable: true });
  });
});

describe("Document search tool", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("缺少 Convex client 时返回可恢复错误", async () => {
    const result = await executeDocumentSearch({ query: "roadmap" }, baseCtx) as any;
    expect(result.documents).toEqual([]);
    expect(result.recoverable).toBe(true);
  });

  it("调用 Convex 元数据搜索并限制 limit", async () => {
    const query = vi.fn().mockResolvedValue({
      query: "roadmap",
      documents: [{ documentId: "doc-1", title: "Roadmap", path: ["Roadmap"] }],
      metadata: { count: 1 },
    });
    const result = await executeDocumentSearch(
      { query: " roadmap ", limit: 100, includeArchived: true, updatedAfter: 123 },
      { ...baseCtx, convex: { query } as any },
    ) as any;

    expect(query).toHaveBeenCalledWith(expect.anything(), {
      query: "roadmap",
      limit: 30,
      includeArchived: true,
      updatedAfter: 123,
    });
    expect(result.documents[0].title).toBe("Roadmap");
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

describe("executeWebExtract", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("拒绝空 URL 和本地地址", async () => {
    await expect(executeWebExtract({ url: "" }, baseCtx))
      .resolves.toMatchObject({ error: "url is required", recoverable: true });
    await expect(executeWebExtract({ url: "http://localhost:3000" }, baseCtx))
      .resolves.toMatchObject({ error: "local and private network URLs are not allowed", recoverable: true });
  });

  it("抓取 HTML 并抽取标题、描述和正文", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      url: "https://example.com/page",
      headers: { get: () => "text/html; charset=utf-8" },
      text: async () => `
        <html>
          <head>
            <title>Example &amp; Demo</title>
            <meta name="description" content="Demo page" />
            <style>.hidden{}</style>
          </head>
          <body><script>bad()</script><main>Hello <strong>world</strong></main></body>
        </html>
      `,
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await executeWebExtract({ url: "https://example.com/page" }, baseCtx) as any;

    expect(result.title).toBe("Example & Demo");
    expect(result.description).toBe("Demo page");
    expect(result.content).toContain("Hello world");
    expect(result.content).not.toContain("bad()");
    expect(fetchMock).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      redirect: "follow",
    }));
  });
});

describe("Memory tools", () => {
  const baseCtx = {
    userId: "user-1",
    model: "test-model",
  };

  it("memory_search 缺少 Convex client 时返回可恢复错误", async () => {
    const result = await executeMemorySearch({ query: "偏好" }, baseCtx) as any;
    expect(result.memories).toEqual([]);
    expect(result.recoverable).toBe(true);
  });

  it("memory_search 调用 Convex 查询并返回记忆", async () => {
    const query = vi.fn().mockResolvedValue([
      { id: "m1", type: "preference", content: "用户偏好中文", matchScore: 1 },
    ]);
    vi.mocked(retrieveRelevantMemories).mockResolvedValue({
      memories: [{ id: "m1", type: "preference", content: "用户偏好中文", matchScore: 0.8 }],
      retrieval: "semantic",
    });
    const result = await executeMemorySearch(
      { query: "中文", type: "preference", limit: 3 },
      { ...baseCtx, convex: { query } as any },
    ) as any;

    expect(query).toHaveBeenCalledWith(expect.anything(), {
      query: undefined,
      type: "preference",
      limit: 100,
    });
    expect(retrieveRelevantMemories).toHaveBeenCalledWith(expect.objectContaining({
      query: "中文",
      topK: 3,
    }));
    expect(result.memories).toHaveLength(1);
    expect(result.metadata.count).toBe(1);
    expect(result.metadata.retrieval).toBe("semantic");
  });

  it("memory_search 只按业务类型和当前上下文检索记忆", async () => {
    const query = vi.fn().mockResolvedValue([
      {
        id: "m1",
        type: "preference",
        content: "用户偏好中文",
        matchScore: 1,
      },
      {
        id: "m2",
        type: "project",
        content: "项目事实",
        matchScore: 1,
      },
    ]);
    vi.mocked(retrieveRelevantMemories).mockResolvedValue({
      memories: [{
        id: "m1",
        type: "preference",
        content: "用户偏好中文",
        matchScore: 0.82,
      }],
      retrieval: "semantic",
    });

    const result = await executeMemorySearch(
      {
        query: "中文",
        type: "preference",
        limit: 5,
      },
      { ...baseCtx, convex: { query } as any },
    ) as any;

    expect(retrieveRelevantMemories).toHaveBeenCalledWith(expect.objectContaining({
      memories: [expect.objectContaining({ id: "m1" })],
      topK: 5,
    }));
    expect(result.memories[0]).toMatchObject({
      id: "m1",
      score: 0.82,
    });
    expect(result.metadata.memoryIds).toEqual(["m1"]);
  });

  it("memory_write 默认创建 pending proposal，不直接写 active", async () => {
    const mutation = vi.fn().mockResolvedValue({
      id: "proposal-1",
      type: "preference",
      content: "用户偏好中文",
      source: "agent_proposed",
      confidence: 1,
      status: "pending_review",
    });
    const result = await executeMemoryWrite(
      { content: "用户偏好中文", type: "preference" },
      { ...baseCtx, convex: { mutation } as any },
    ) as any;

    expect(result.dryRun).toBe(true);
    expect(result.confirmationRequired).toBe(true);
    expect(result.action).toBe("memory_propose");
    expect(result.proposalId).toBe("proposal-1");
    expect(result.proposalStatus).toBe("pending_review");
    expect(result.memory.content).toBe("用户偏好中文");
    expect(mutation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      content: "用户偏好中文",
      type: "preference",
      source: "agent_proposed",
    }));
  });

  it("memory_write dryRun=false 时写入 Convex", async () => {
    const mutation = vi.fn().mockResolvedValue({
      id: "m1",
      type: "preference",
      content: "用户偏好中文",
      source: "user_explicit",
      confidence: 1,
      updatedAt: 123,
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
    expect(syncAgentMemory).toHaveBeenCalledWith({
      userId: "user-1",
      memory: expect.objectContaining({
        id: "m1",
        content: "用户偏好中文",
      }),
    });
  });

  it("memory_write 空内容返回错误", async () => {
    const result = await executeMemoryWrite({ content: "   " }, baseCtx) as any;
    expect(result.error).toBe("content is required");
    expect(result.recoverable).toBe(true);
  });
});
