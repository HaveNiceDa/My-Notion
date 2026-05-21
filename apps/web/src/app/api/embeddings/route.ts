import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { EMB_MODEL, EMB_DIMENSION } from "@notion/ai/config";

const DASHSCOPE_EMB_BASE_URL =
  process.env.DASHSCOPE_EMB_BASE_URL ||
  "https://dashscope.aliyuncs.com/api/v1";
const DASHSCOPE_EMB_PATH = "/services/embeddings/multimodal-embedding/multimodal-embedding";

async function callDashScopeEmbedAPI(texts: string[]): Promise<number[][]> {
  const contents = texts.map((t) => ({ text: t }));

  const response = await fetch(DASHSCOPE_EMB_BASE_URL + DASHSCOPE_EMB_PATH, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMB_MODEL,
      input: { contents },
      parameters: {
        output_type: "dense",
        dimension: EMB_DIMENSION,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DashScope embedding request failed with status ${response.status}: ${errorText}`,
    );
  }

  const data = await response.json();

  if (data.code) {
    throw new Error(
      `DashScope embedding request failed: ${data.code}: ${data.message}`,
    );
  }

  if (!data.output?.embeddings || data.output.embeddings.length !== texts.length) {
    throw new Error(
      `Embedding response count mismatch: want ${texts.length}, got ${data.output?.embeddings?.length ?? 0}`,
    );
  }

  const vectors: number[][] = new Array(texts.length);
  for (const item of data.output.embeddings) {
    vectors[item.index] = item.embedding;
  }

  return vectors;
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { input, inputs } = await req.json();

    if (inputs && Array.isArray(inputs)) {
      const embeddingsList = await callDashScopeEmbedAPI(inputs);
      return NextResponse.json({ embeddings: embeddingsList });
    }

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const results = await callDashScopeEmbedAPI([input]);
    return NextResponse.json({ embedding: results[0] });
  } catch (error) {
    console.error("Error in embeddings API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
