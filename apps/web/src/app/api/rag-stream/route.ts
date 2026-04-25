import { NextRequest, NextResponse } from "next/server";
import { streamRAG, ConvexDataSource, type AIStreamEvent } from "@notion/ai/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      query,
      conversationHistory,
      model,
      minScore,
      knowledgeBaseEnabled,
      conversationId,
      enableThinking = false,
    } = body;

    if (!userId || !query) {
      return NextResponse.json(
        { success: false, error: "userId and query are required" },
        { status: 400 },
      );
    }

    const dataSource = new ConvexDataSource(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
