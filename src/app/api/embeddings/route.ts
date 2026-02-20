import { NextRequest, NextResponse } from "next/server";
import { AlibabaTongyiEmbeddings } from "@langchain/community/embeddings/alibaba_tongyi";

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const { input, inputs } = await req.json();

    // 初始化通义千问embeddings
    const embeddings = new AlibabaTongyiEmbeddings({
      modelName: "text-embedding-v4",
      apiKey: process.env.LLM_API_KEY,
    });

    // 批量处理模式
    if (inputs && Array.isArray(inputs)) {
      const embeddingsList = await embeddings.embedDocuments(inputs);
      return NextResponse.json({ embeddings: embeddingsList });
    }

    // 单个处理模式
    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const embedding = await embeddings.embedQuery(input);
    return NextResponse.json({ embedding });
  } catch (error) {
    console.error("Error in embeddings API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
