import { describe, expect, it, vi } from "vitest";
import {
  createDocumentTool,
  readmeTool,
  searchDocumentsTool,
  updateDocumentTool,
} from "../src/index.js";
import type { AgentToolContext, DocumentResult } from "../src/index.js";

function createDocument(overrides: Partial<DocumentResult> = {}): DocumentResult {
  return {
    id: "doc_1",
    title: "Test",
    content: "# Test",
    contentMarkdown: "# Test",
    contentFormat: "markdown",
    isArchived: false,
    isPublished: false,
    isInKnowledgeBase: true,
    lastEditedTime: 1,
    ...overrides,
  };
}

function createContext(): AgentToolContext {
  return {
    client: {
      searchDocuments: vi.fn(async () => ({ documents: [createDocument()] })),
      fetchDocument: vi.fn(async () => createDocument()),
      createDocument: vi.fn(async () => createDocument({ id: "created" })),
      updateDocument: vi.fn(async () => createDocument({ id: "updated" })),
    },
  };
}

describe("@mynotion/agent-tools docs tools", () => {
  it("readme 返回工具列表和安全说明", () => {
    const result = readmeTool();

    expect(result.structuredContent.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "my_notion_readme" }),
        expect.objectContaining({ name: "my_notion_docs_create" }),
      ]),
    );
    expect(result.content[0]?.text).toContain("dryRun: true");
  });

  it("readme exposes the selected profile so MCP clients do not guess auth state", () => {
    const result = readmeTool({ local: true });

    expect(result.structuredContent.auth).toMatchObject({
      profile: expect.objectContaining({
        name: "local",
        environment: "local",
      }),
    });
    expect(result.content[0]?.text).toContain("my-notion-mcp --transport stdio --local");
    expect(result.content[0]?.text).toContain("Token configured");
  });

  it("readme defaults to prod even when MY_NOTION_PROFILE points at local", () => {
    const previousProfile = process.env.MY_NOTION_PROFILE;
    process.env.MY_NOTION_PROFILE = "local";

    try {
      const result = readmeTool();

      expect(result.structuredContent.auth).toMatchObject({
        profile: expect.objectContaining({
          name: "prod",
          environment: "prod",
        }),
      });
    } finally {
      if (previousProfile === undefined) {
        delete process.env.MY_NOTION_PROFILE;
      } else {
        process.env.MY_NOTION_PROFILE = previousProfile;
      }
    }
  });

  it("search 调用 client 并返回文档列表", async () => {
    const context = createContext();
    const result = await searchDocumentsTool({ query: "roadmap", limit: 99 }, context);

    expect(context.client.searchDocuments).toHaveBeenCalledWith({ query: "roadmap", limit: 50 });
    expect(result.structuredContent.documents).toHaveLength(1);
  });

  it("create 默认 dry-run 且不调用真实写入", async () => {
    const context = createContext();
    const result = await createDocumentTool({ title: "Draft" }, context);

    expect(context.client.createDocument).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      action: "create",
      confirmationRequired: true,
    });
  });

  it("update 默认 dry-run 且不调用真实写入", async () => {
    const context = createContext();
    const result = await updateDocumentTool({ id: "doc_1", contentMarkdown: "Append" }, context);

    expect(context.client.updateDocument).not.toHaveBeenCalled();
    expect(result.structuredContent).toMatchObject({
      dryRun: true,
      action: "update",
      confirmationRequired: true,
    });
  });

  it("create 在 dryRun=false 时调用真实写入", async () => {
    const context = createContext();
    const result = await createDocumentTool({ title: "Real", dryRun: false }, context);

    expect(context.client.createDocument).toHaveBeenCalledWith({
      title: "Real",
      contentMarkdown: undefined,
    });
    expect(result.structuredContent).toMatchObject({ dryRun: false, action: "create" });
  });
});
