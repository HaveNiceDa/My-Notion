import { Embeddings } from "@langchain/core/embeddings";
import { AsyncCallerParams } from "@langchain/core/utils/async_caller";

/**
 * 自定义Embeddings类，通过内部API路由调用embeddings服务
 * 避免CORS错误
 */
export class CustomEmbeddings extends Embeddings {
  constructor(params?: AsyncCallerParams) {
    super(params ?? {});
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      const embedding = await this.embedQuery(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ input: text }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get embedding: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  }
}
