import { NextRequest, NextResponse } from "next/server";
import { runRAGQuery, type AIModel } from "@/src/lib/rag/ragUtils";

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[RAG API] 接收到请求: ${action}`);

    switch (action) {
      case "runRAGQuery":
        const {
          userId,
          query,
          model,
          minScore,
          conversationHistory,
          knowledgeBaseEnabled,
          conversationId,
        } = params;

        const answer = await runRAGQuery(
          userId,
          query,
          model,
          minScore,
          conversationHistory,
          knowledgeBaseEnabled,
          conversationId,
        );

        return NextResponse.json({ success: true, answer });

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG API error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
