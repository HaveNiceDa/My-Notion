import OpenAI from "openai";
import { DASHSCOPE_BASE_URL } from "@notion/ai/config";

// 联网搜索：通过 DashScope enable_search 能力搜索互联网实时信息
// 内部发起一次独立的 LLM 调用（带 enable_search），让平台执行搜索并返回结果
export async function executeWebSearch(
  args: Record<string, unknown>,
  model: string,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return { query, results: [], error: "query is required" };
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return { query, results: [], error: "LLM_API_KEY is not configured" };
  }

  const strategy = typeof args.strategy === "string" ? args.strategy : "turbo";

  try {
    const openai = new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });

    // DashScope 扩展参数，不在 OpenAI SDK 类型中，需要类型断言
    const createParams = {
      model,
      messages: [
        {
          role: "system" as const,
          content:
            "你是一个搜索助手。根据用户查询，使用联网搜索获取最新信息，然后整理返回搜索结果。只返回搜索到的关键信息，不要添加个人观点。",
        },
        { role: "user" as const, content: query },
      ],
      enable_search: true,
      search_options: { search_strategy: strategy },
    };

    const completion = await openai.chat.completions.create(
      createParams as OpenAI.ChatCompletionCreateParamsNonStreaming,
    );

    const content = completion.choices[0]?.message?.content || "";
    return { query, strategy, content };
  } catch (error) {
    return {
      query,
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
