import { getJson } from "serpapi";
import type { ToolContext } from "./types";
import { enqueueEvent } from "../stream";
import { buildToolErrorResult, withToolResultContract } from "./result-contract";

interface SerpOrganicResult {
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerpApiResponse {
  organic_results?: SerpOrganicResult[];
}

// 联网搜索：通过 SerpAPI 调用 Google 搜索获取实时信息
// 返回结构化搜索结果（标题 + 链接 + 摘要），LLM 在 ReAct 循环中自主判断如何使用
export async function executeWebSearch(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return {
      query,
      results: [],
      ...buildToolErrorResult("web_search", "query is required", { reason: "validation_error" }),
    };
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return {
      query,
      results: [],
      ...buildToolErrorResult("web_search", "SERPAPI_API_KEY is not configured", { reason: "unavailable" }),
    };
  }

  try {
    const response = await getJson({
      engine: "google",
      q: query,
      api_key: apiKey,
      hl: "zh-cn",
      gl: "cn",
    }) as SerpApiResponse;

    const organicResults = (response.organic_results ?? []).slice(0, 5);
    const formattedResults = organicResults.map((result) => ({
      title: result.title ?? "",
      link: result.link ?? "",
      snippet: result.snippet ?? "",
    }));

    // 向前端推送搜索结果摘要
    const { stream: streamOutput } = ctx;
    if (streamOutput && formattedResults.length > 0) {
      const summary = formattedResults
        .map((r: { title: string; snippet: string }, i: number) => `${i + 1}. ${r.title}: ${r.snippet}`)
        .join("\n");
      enqueueEvent(streamOutput.controller, streamOutput.encoder, {
        type: "tool-result-delta",
        toolCallId: streamOutput.toolCallId,
        delta: summary,
      });
    }

    return withToolResultContract("web_search", {
      query,
      results: formattedResults,
    }, {
      summary: `Found ${formattedResults.length} web result(s) for "${query}".`,
      sources: formattedResults.map((result) => ({
        type: "web",
        title: result.title,
        url: result.link,
      })),
      metadata: {
        count: formattedResults.length,
        provider: "serpapi",
      },
    });
  } catch (error) {
    return {
      query,
      results: [],
      ...buildToolErrorResult("web_search", error),
    };
  }
}
