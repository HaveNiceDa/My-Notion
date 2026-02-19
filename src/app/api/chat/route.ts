import { NextRequest } from "next/server";
import { ChatAlibabaTongyi } from "@langchain/community/chat_models/alibaba_tongyi";

const AI_MODELS = ["qwen-plus", "qwen-max", "qwen3-coder-plus"] as const;

type AIModel = (typeof AI_MODELS)[number];

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
      : "qwen-max";

    // 初始化通义千问模型
    const model = new ChatAlibabaTongyi({
      model: validatedModelName,
      alibabaApiKey: process.env.LLM_API_KEY,
    });

    // 创建流式响应
    const stream = await model.stream(messages);

    // 创建可读流
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.content;
            if (text) {
              const encoded = encoder.encode(
                Array.isArray(text)
                  ? text
                      .map((t) => (typeof t === "string" ? t : t.text || ""))
                      .join("")
                  : text,
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
