import { Embeddings } from "@langchain/core/embeddings";

const DASHSCOPE_EMB_BASE_URL =
  process.env.DASHSCOPE_EMB_BASE_URL ||
  "https://dashscope.aliyuncs.com/api/v1";
const DASHSCOPE_EMB_PATH = "/services/embeddings/multimodal-embedding/multimodal-embedding";
const EMB_MODEL_ID = "tongyi-embedding-vision-plus-2026-03-06";
const EMB_DIMENSION = 1024;

export class CustomEmbeddings extends Embeddings {
  private apiKey: string;
  private baseURL: string;

  constructor() {
    super({});
    this.apiKey = process.env.LLM_API_KEY || "";
    this.baseURL = DASHSCOPE_EMB_BASE_URL;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    console.log(`[CustomEmbeddings] 生成 ${texts.length} 个文档的嵌入...`);
    return this.callEmbedAPI(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    console.log(`[CustomEmbeddings] 生成查询的嵌入...`);
    const results = await this.callEmbedAPI([text]);
    return results[0];
  }

  private async callEmbedAPI(texts: string[]): Promise<number[][]> {
    const contents = texts.map((t) => ({ text: t }));

    const response = await fetch(this.baseURL + DASHSCOPE_EMB_PATH, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMB_MODEL_ID,
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

    const data: any = await response.json();

    if (data.code) {
      throw new Error(
        `DashScope embedding request failed: ${data.code}: ${data.message}`,
      );
    }

    if (
      !data.output?.embeddings ||
      data.output.embeddings.length !== texts.length
    ) {
      throw new Error(
        `Embedding response count mismatch: want ${texts.length}, got ${data.output?.embeddings?.length ?? 0}`,
      );
    }

    const vectors: number[][] = new Array(texts.length);
    for (const item of data.output.embeddings) {
      if (item.index < 0 || item.index >= texts.length) {
        throw new Error(`Embedding response index out of range: ${item.index}`);
      }
      if (!item.embedding || item.embedding.length === 0) {
        throw new Error(`Embedding vector is empty at index ${item.index}`);
      }
      vectors[item.index] = item.embedding;
    }

    return vectors;
  }
}

export { EMB_MODEL_ID, EMB_DIMENSION };
