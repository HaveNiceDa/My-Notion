import { NextRequest } from "next/server";
import OpenAI from "openai";
import {
  AI_MODELS,
  type AIModel,
  DEFAULT_MODEL,
  getActualModelId,
  DASHSCOPE_BASE_URL,
} from "@/src/lib/ai/config";

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      model: modelName,
      enableThinking = false,
      enableSearch = false,
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const validatedModelName = (AI_MODELS as readonly string[]).includes(
      modelName,
    )
      ? (modelName as AIModel)
      : DEFAULT_MODEL;

    // 将通用模型ID转换为实际模型ID
    const actualModelId = getActualModelId(validatedModelName);

    // 初始化OpenAI客户端（用于调用阿里云百炼API）
    const openai = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: DASHSCOPE_BASE_URL,
    });

    // 构建请求参数
    const requestParams: any = {
      model: actualModelId,
      messages: messages,
      stream: true,
    };

    // 如果启用深度思考或联网搜索，添加 extra_body 参数
    requestParams.extra_body = {};
    if (enableThinking) {
      requestParams.extra_body.enable_thinking = true;
    }
    if (enableSearch) {
      requestParams.extra_body.enable_search = true;
    }
    // 如果 extra_body 为空，删除它
    if (Object.keys(requestParams.extra_body).length === 0) {
      delete requestParams.extra_body;
    }

    // 创建流式响应
    const stream = await openai.chat.completions.create(requestParams);

    // 创建可读流
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // 类型断言处理 stream
          const streamIterator = stream as any;
          for await (const chunk of streamIterator) {
            const delta = chunk.choices[0]?.delta;

            // 检查是否有 reasoning_content（深度思考内容）- 仅在 enableThinking 为 true 时才处理
            const reasoningContent = enableThinking
              ? (delta as any)?.reasoning_content
              : undefined;
            // 检查是否有常规 content
            const text = delta?.content;

            // 构建响应数据
            const responseData: any = {};
            if (reasoningContent) {
              responseData.reasoning_content = reasoningContent;
            }
            if (text) {
              responseData.content = text;
            }

            // 只有当有内容时才发送
            if (Object.keys(responseData).length > 0) {
              const encoded = encoder.encode(
                JSON.stringify(responseData) + "\n",
              );
              controller.enqueue(encoded);
            }
          }
          controller.close();
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
