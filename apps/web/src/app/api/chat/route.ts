import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";

export const runtime = "edge";
export const preferredRegion = "hkg1";

const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const {
      messages,
      model,
      enableThinking = false,
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "LLM_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const openai = new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });

    const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
      model,
      messages: messages as OpenAI.ChatCompletionMessageParam[],
      stream: true,
    };

    if (enableThinking) {
      (requestParams as unknown as Record<string, unknown>).extra_body = {
        enable_thinking: true,
        thinking_budget: 50,
      };
    }

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          const response = await openai.chat.completions.create(requestParams);

          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            const reasoningContent = enableThinking
              ? (delta as Record<string, unknown>)?.reasoning_content as string | undefined
              : undefined;
            if (reasoningContent) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: "reasoning", text: reasoningContent }) + "\n"),
              );
            }

            const text = delta?.content;
            if (text) {
              controller.enqueue(
                encoder.encode(JSON.stringify({ type: "content", text }) + "\n"),
              );
            }
          }

          controller.enqueue(
            encoder.encode(JSON.stringify({ type: "done" }) + "\n"),
          );
          controller.close();
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                message: error instanceof Error ? error.message : String(error),
              }) + "\n",
            ),
          );
          controller.close();
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
    console.error("[Chat API] Error in chat API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
