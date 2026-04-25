import { NextRequest, NextResponse } from "next/server";
import { streamRAG, ConvexDataSource, type AIStreamEvent } from "@notion/ai/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "runRAGQuery": {
        const {
          userId,
          query,
          model,
          minScore,
          conversationHistory,
          knowledgeBaseEnabled,
          conversationId,
        } = params;

        const dataSource = new ConvexDataSource(process.env.NEXT_PUBLIC_CONVEX_URL!);

        let fullContent = "";

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
          },
          (event: AIStreamEvent) => {
            if (event.type === "content") {
              fullContent += event.text;
            }
          },
        );

        return NextResponse.json({ success: true, answer: fullContent });
      }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG API error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
