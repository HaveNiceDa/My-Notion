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
    const { messages, model: modelName } = await req.json();

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

    // 创建流式响应
    const stream = await openai.chat.completions.create({
      model: actualModelId,
      messages: messages,
      stream: true,
    });

    // 创建可读流
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content;
            if (text) {
              const encoded = encoder.encode(text);
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
        "Content-Type": "text/plain",
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