import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { EMB_MODEL, DASHSCOPE_BASE_URL } from "@notion/ai/config";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { input, inputs } = await req.json();

    const openai = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: DASHSCOPE_BASE_URL,
    });

    if (inputs && Array.isArray(inputs)) {
      const response = await openai.embeddings.create({
        model: EMB_MODEL,
        input: inputs,
      });

      const embeddingsList = response.data.map(item => item.embedding);
      return NextResponse.json({ embeddings: embeddingsList });
    }

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
