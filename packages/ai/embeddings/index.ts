import { Embeddings } from "@langchain/core/embeddings";
import OpenAI from "openai";
import { EMB_MODEL, DASHSCOPE_BASE_URL } from "../config";

export class CustomEmbeddings extends Embeddings {
  private openai: OpenAI;

  constructor() {
    super({});
    this.openai = new OpenAI({
      apiKey: process.env.LLM_API_KEY,
      baseURL: DASHSCOPE_BASE_URL,
    });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    console.log(`[CustomEmbeddings] 生成 ${texts.length} 个文档的嵌入...`);

    const response = await this.openai.embeddings.create({
      model: EMB_MODEL,
      input: texts,
    });

    const embeddingsList = response.data.map(item => item.embedding);
    return embeddingsList;
  }

  async embedQuery(text: string): Promise<number[]> {
    console.log(`[CustomEmbeddings] 生成查询的嵌入...`);

    const response = await this.openai.embeddings.create({
      model: EMB_MODEL,
      input: text,
    });

    return response.data[0].embedding;
  }
}
