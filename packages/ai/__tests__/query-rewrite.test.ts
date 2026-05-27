import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
}));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: mocks.create,
        },
      },
    };
  }),
}));

import { rewriteQueryForDeepRetrieval } from "../server/retrieval/query-rewrite";

describe("rewriteQueryForDeepRetrieval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LLM_API_KEY = "test-key";
  });

  it("优先使用 LLM 生成关键词版和语义扩展版 query", async () => {
    mocks.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              keywordQuery: "requestId RATE_LIMITED cliAuditLogs",
              semanticQuery: "机器 API 限流错误追踪与审计日志排查",
            }),
          },
        },
      ],
    });

    const variants = await rewriteQueryForDeepRetrieval("之前的限流怎么查");

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(variants).toEqual([
      { kind: "original", query: "之前的限流怎么查" },
      { kind: "keyword", query: "requestId RATE_LIMITED cliAuditLogs" },
      { kind: "semantic", query: "机器 API 限流错误追踪与审计日志排查" },
    ]);
  });

  it("LLM 不可用时回退到本地改写", async () => {
    delete process.env.LLM_API_KEY;

    const variants = await rewriteQueryForDeepRetrieval("requestId 限流策略");

    expect(mocks.create).not.toHaveBeenCalled();
    expect(variants).toEqual([
      { kind: "original", query: "requestId 限流策略" },
      { kind: "keyword", query: "requestId 限流策略" },
      { kind: "semantic", query: "requestId 限流策略" },
    ]);
  });
});
