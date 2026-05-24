import { getJson } from "serpapi";
import type { ToolContext } from "./types";
import { enqueueEvent } from "../stream";

// 联网搜索：通过 SerpAPI 调用 Google 搜索获取实时信息
// 返回结构化搜索结果（标题 + 链接 + 摘要），LLM 在 ReAct 循环中自主判断如何使用
export async function executeWebSearch(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return { query, results: [], error: "query is required" };
  }

  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    return { query, results: [], error: "SERPAPI_API_KEY is not configured" };
  }

  try {
    const response = await getJson({
      engine: "google",
      q: query,
      api_key: apiKey,
      hl: "zh-cn",
      gl: "cn",
    });

    const organicResults = (response.organic_results ?? []).slice(0, 5);
    const formattedResults = organicResults.map((result: any) => ({
      title: result.title,
      link: result.link,
      snippet: result.snippet,
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

    return { query, results: formattedResults };
  } catch (error) {
    return {
      query,
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
