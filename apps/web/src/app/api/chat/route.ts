import { NextRequest } from "next/server";
import { streamChat, type AIStreamEvent, type ChatMessage } from "@notion/ai/server";

export async function POST(req: NextRequest) {
  try {
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

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        await streamChat(
          messages as ChatMessage[],
          { model, enableThinking },
          (event: AIStreamEvent) => {
            controller.enqueue(
              encoder.encode(JSON.stringify(event) + "\n"),
            );
          },
        );
        controller.close();
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
