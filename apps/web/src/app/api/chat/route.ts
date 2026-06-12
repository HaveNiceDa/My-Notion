import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getActualModelId } from "@notion/ai/config";
import { streamChat, type AIStreamEvent, type ChatMessage } from "@notion/ai/server";
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:8081",
  "http://localhost:19000",
  "http://localhost:19006",
  "https://notion-j9zj.vercel.app",
];

function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function enqueueSSE(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: AIStreamEvent,
): void {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function POST(request: NextRequest) {
  const corsHeaders = getCorsHeaders(request);

  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders },
      );
    }

    const rateLimitResult = await checkRateLimit(userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": String(rateLimitResult.reset),
            "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = await request.json();
    const messages = body.messages as ChatMessage[] | undefined;
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: "messages must be an array" },
        { status: 400, headers: corsHeaders },
      );
    }

    const model = getActualModelId(body.model || body.modelId || "deepseek-v4-pro");
    const enableThinking = Boolean(body.enableThinking);
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await streamChat(
            messages,
            { model, enableThinking },
            (event) => enqueueSSE(controller, encoder, event),
          );
          enqueueSSE(controller, encoder, { type: "done" });
        } catch (error) {
          enqueueSSE(controller, encoder, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    console.error("[Mobile Chat API] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500, headers: corsHeaders },
    );
  }
}
