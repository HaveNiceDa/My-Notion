import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { streamRAG, ConvexDataSource, type AIStreamEvent } from "@notion/ai/server";

async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient | null> {
  const { getToken, userId } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "convex" });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) {
    client.setAuth(token);
  }
  return client;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const {
      query,
      conversationHistory,
      model,
      minScore,
      knowledgeBaseEnabled,
      conversationId,
      enableThinking = false,
    } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: "query is required" },
        { status: 400 },
      );
    }

    const { getToken: getStreamToken } = await auth();
    const streamToken = await getStreamToken({ template: "convex" });
    const dataSource = new ConvexDataSource(
      process.env.NEXT_PUBLIC_CONVEX_URL!,
      streamToken ?? undefined,
    );

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        await streamRAG(
          query,
          {
            userId,
            model,
            conversationHistory: conversationHistory || [],
            dataSource,
            minScore,
            knowledgeBaseEnabled,
            conversationId,
            enableThinking,
          },
          (event: AIStreamEvent) => {
            const sseEvent = event.type;
            controller.enqueue(
              encoder.encode(`event: ${sseEvent}\ndata: ${JSON.stringify(event)}\n\n`),
            );
          },
        );

        controller.close();
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("RAG API error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
