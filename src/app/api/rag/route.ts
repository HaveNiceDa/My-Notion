import { NextRequest, NextResponse } from "next/server";
import { runRAGQuery } from "@/src/lib/rag";

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const { query, userId } = await req.json();

    if (!query || !userId) {
      return NextResponse.json(
        { error: "Missing query or userId" },
        { status: 400 },
      );
    }

    // 执行RAG查询
    const answer = await runRAGQuery(userId, query);

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Error in RAG API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
