import { describe, it, expect, vi } from "vitest";

vi.mock("@notion/ai/server", () => ({
  getOrCreateVectorStore: vi.fn(),
}));

vi.mock("@notion/ai/utils", () => ({
  extractTextFromDocument: vi.fn((content: string) => content),
}));

import { buildAvailableTools } from "../tools/registry";
import { knowledgeSearchTool, documentReadTool, webSearchTool } from "../tools/definitions";

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

  it("documentReadTool 不需要必填参数", () => {
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
