import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { streamRAG, ConvexDataSource, type AIStreamEvent } from "@notion/ai/server";

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "runRAGQuery": {
        const {
          query,
          model,
          minScore,
          conversationHistory,
          knowledgeBaseEnabled,
          conversationId,
        } = params;

        const token = await getToken({ template: "convex" });
        const dataSource = new ConvexDataSource(
          process.env.NEXT_PUBLIC_CONVEX_URL!,
          token ?? undefined,
        );

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
