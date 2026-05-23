import OpenAI from "openai";
import { DASHSCOPE_BASE_URL } from "@notion/ai/config";
import type { ToolContext } from "./types";
import { enqueueEvent } from "../stream";

// 联网搜索：通过 DashScope enable_search 流式搜索互联网实时信息
// 使用流式调用降低延迟，同时向前端推送 tool-result-delta 事件展示搜索进度
export async function executeWebSearch(
  args: Record<string, unknown>,
  ctx: ToolContext,
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

    const createParams = {
      model: ctx.model,
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
      stream: true,
    };

    const stream = await openai.chat.completions.create(
      createParams as OpenAI.ChatCompletionCreateParamsStreaming,
    );

    let content = "";
    const { stream: streamOutput } = ctx;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        content += delta;
        // 向前端推送搜索结果增量，用户可实时看到搜索内容
        if (streamOutput) {
          enqueueEvent(streamOutput.controller, streamOutput.encoder, {
            type: "tool-result-delta",
            toolCallId: streamOutput.toolCallId,
            delta,
          });
        }
      }
    }

    return { query, strategy, content };
  } catch (error) {
    return {
      query,
      results: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
