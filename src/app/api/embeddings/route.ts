import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { EMB_MODEL, DASHSCOPE_BASE_URL } from "@/src/lib/ai/config";

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const { input, inputs } = await req.json();

    // 初始化OpenAI客户端
    const openai = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: DASHSCOPE_BASE_URL,
    });

    // 批量处理模式
    if (inputs && Array.isArray(inputs)) {
      console.log(`[Embeddings API] 处理 ${inputs.length} 个输入`);
      
      const response = await openai.embeddings.create({
        model: EMB_MODEL,
        input: inputs,
      });
      
      const embeddingsList = response.data.map(item => item.embedding);
      return NextResponse.json({ embeddings: embeddingsList });
    }

    // 单个处理模式
    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const response = await openai.embeddings.create({
      model: EMB_MODEL,
      input: input,
    });
    
    const embedding = response.data[0].embedding;
    return NextResponse.json({ embedding });
  } catch (error) {
    console.error("Error in embeddings API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
