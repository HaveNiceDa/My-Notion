import { z } from "zod";
import { BaseTool } from "./base";
import { getJson } from "serpapi";

export class WebSearchTool extends BaseTool {
  name = "web_search";
  description =
    "当你需要查询最新的网络信息、新闻、天气或其他实时数据时非常有用";

  inputSchema = z.object({
    query: z.string().describe("搜索关键词或问题"),
  });

  async execute(input: z.infer<typeof this.inputSchema>) {
    try {
      const apiKey = process.env.SERPAPI_API_KEY;
      if (!apiKey) {
        throw new Error("SERPAPI_API_KEY is not configured");
      }

      const response = await getJson({
        engine: "google",
        q: input.query,
        api_key: apiKey,
      });

      const results = response.organic_results?.slice(0, 3) || [];
      const formattedResults = results.map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
      }));

      return {
        query: input.query,
        results: formattedResults,
      };
    } catch (error) {
      console.error("Web search error:", error);
      throw new Error("Failed to perform web search");
    }
  }
}
