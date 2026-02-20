import { Embeddings } from "@langchain/core/embeddings";
import { AsyncCallerParams } from "@langchain/core/utils/async_caller";

/**
 * 自定义Embeddings类，通过内部API路由调用embeddings服务
 * 避免CORS错误
 */
export class CustomEmbeddings extends Embeddings {
  private embeddingCache = new Map<string, number[]>();

  constructor(params?: AsyncCallerParams) {
    super(params ?? {});
  }

  /**
   * 批量嵌入文档 - 使用批量API提高效率
   */
  async embedDocuments(texts: string[]): Promise<number[][]> {
    const uncachedTexts: string[] = [];
    const uncachedIndices: number[] = [];
    const result: number[][] = new Array(texts.length);

    texts.forEach((text, index) => {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        result[index] = cached;
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(index);
      }
    });

    if (uncachedTexts.length > 0) {
      const response = await fetch("/api/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: uncachedTexts }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get embeddings: ${response.statusText}`);
      }

      const data = await response.json();
      const embeddings = data.embeddings;

      embeddings.forEach((embedding: number[], i: number) => {
        const originalIndex = uncachedIndices[i];
        result[originalIndex] = embedding;
        this.embeddingCache.set(uncachedTexts[i], embedding);
      });
    }

    return result;
  }

  /**
   * 嵌入单个查询
   */
  async embedQuery(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) {
      return cached;
    }

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
    const embedding = data.embedding;
    this.embeddingCache.set(text, embedding);
    return embedding;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}
