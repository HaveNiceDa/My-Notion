import { describe, it, expect, vi } from "vitest";

vi.mock("@notion/ai/utils", () => ({
  extractTextFromDocument: vi.fn((content: string) => content),
}));

import { executeDocumentRead } from "../tools/document-read";
import { extractTextFromDocument } from "@notion/ai/utils";

describe("executeDocumentRead", () => {
  it("无当前文档时返回错误", () => {
    const result = executeDocumentRead(null);
    expect(result).toEqual({ document: null, error: "current document is not available" });
  });

  it("无文档 id 时返回错误", () => {
    const result = executeDocumentRead({ id: "", title: "Test" });
    expect(result).toEqual({ document: null, error: "current document is not available" });
  });

  it("有文档时返回文档信息", () => {
    const result = executeDocumentRead({
      id: "doc-1",
      title: "My Document",
      content: "Hello world",
    }) as { document: { id: string; title: string; content: string } };

    expect(result.document.id).toBe("doc-1");
    expect(result.document.title).toBe("My Document");
    expect(result.document.content).toBe("Hello world");
  });

  it("无标题时使用 Untitled", () => {
    const result = executeDocumentRead({
      id: "doc-2",
      title: "",
      content: "Content",
    }) as { document: { title: string } };

    expect(result.document.title).toBe("Untitled");
  });

  it("无内容时返回空字符串", () => {
    const result = executeDocumentRead({
      id: "doc-3",
      title: "Empty Doc",
    }) as { document: { content: string } };

    expect(result.document.content).toBe("");
  });

  it("extractTextFromDocument 异常时回退到原始内容", () => {
    vi.mocked(extractTextFromDocument).mockImplementationOnce(() => {
      throw new Error("parse error");
    });

    const result = executeDocumentRead({
      id: "doc-4",
      title: "Fallback Doc",
      content: "raw content",
    }) as { document: { content: string } };

    expect(result.document.content).toBe("raw content");
  });

  it("content 为 null 时返回空字符串", () => {
    const result = executeDocumentRead({
      id: "doc-5",
      title: "Null Content",
      content: null,
    }) as { document: { content: string } };

    expect(result.document.content).toBe("");
  });

  it("undefined 传入时返回错误", () => {
    const result = executeDocumentRead(undefined);
    expect(result).toEqual({ document: null, error: "current document is not available" });
  });
});
