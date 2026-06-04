import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearToolResultCache,
  getCachedToolResult,
  getToolSignature,
  getToolResultCacheSize,
  invalidateToolResultCache,
  setCachedToolResult,
} from "../tool-result-cache";

describe("tool-result-cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    clearToolResultCache();
  });

  it("规范化参数顺序，生成稳定 tool signature", () => {
    expect(getToolSignature("web_extract", { b: 2, a: { d: 4, c: 3 } }))
      .toBe(getToolSignature("web_extract", { a: { c: 3, d: 4 }, b: 2 }));
  });

  it("只读 tool 结果在 5 分钟 TTL 内可复用，过期后失效", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00.000Z"));

    const context = { userId: "user-1", model: "test-model" };
    const args = { url: "https://example.com" };
    setCachedToolResult("web_extract", args, context, '{"ok":true}');

    expect(getCachedToolResult("web_extract", args, context)).toEqual({
      hit: true,
      value: '{"ok":true}',
    });

    vi.setSystemTime(new Date("2026-05-28T00:05:01.000Z"));
    expect(getCachedToolResult("web_extract", args, context)).toEqual({ hit: false });
  });

  it("缓存按用户和当前文档上下文隔离", () => {
    const args = { query: "roadmap" };
    const userOneContext = {
      userId: "user-1",
      model: "test-model",
      currentDocument: { id: "doc-1", title: "A", content: "alpha" },
    };
    const userTwoContext = {
      userId: "user-2",
      model: "test-model",
      currentDocument: { id: "doc-1", title: "A", content: "alpha" },
    };
    const changedDocumentContext = {
      userId: "user-1",
      model: "test-model",
      currentDocument: { id: "doc-1", title: "A", content: "beta" },
    };

    setCachedToolResult("document_read", args, userOneContext, '{"content":"alpha"}');

    expect(getCachedToolResult("document_read", args, userOneContext).hit).toBe(true);
    expect(getCachedToolResult("document_read", args, userTwoContext).hit).toBe(false);
    expect(getCachedToolResult("document_read", args, changedDocumentContext).hit).toBe(false);
  });

  it("写类 tool 不会写入跨请求缓存", () => {
    const context = { userId: "user-1", model: "test-model" };
    const args = { title: "Plan", contentMarkdown: "hello" };

    setCachedToolResult("document_write", args, context, '{"dryRun":true}');

    expect(getCachedToolResult("document_write", args, context)).toEqual({ hit: false });
  });

  it("可以按用户和 tool name 失效 memory_search 缓存", () => {
    const userOneContext = { userId: "user-1", model: "test-model" };
    const userTwoContext = { userId: "user-2", model: "test-model" };

    setCachedToolResult("memory_search", { query: "style" }, userOneContext, '{"memories":[1]}');
    setCachedToolResult("web_extract", { url: "https://example.com" }, userOneContext, '{"content":"ok"}');
    setCachedToolResult("memory_search", { query: "style" }, userTwoContext, '{"memories":[2]}');

    expect(invalidateToolResultCache({
      userId: "user-1",
      toolNames: ["memory_search"],
    })).toBe(1);

    expect(getCachedToolResult("memory_search", { query: "style" }, userOneContext)).toEqual({ hit: false });
    expect(getCachedToolResult("web_extract", { url: "https://example.com" }, userOneContext).hit).toBe(true);
    expect(getCachedToolResult("memory_search", { query: "style" }, userTwoContext).hit).toBe(true);
    expect(getToolResultCacheSize()).toBe(2);
  });
});
