import { Embeddings } from "@langchain/core/embeddings";
import { AsyncCallerParams } from "@langchain/core/utils/async_caller";

/**
 * LRU缓存实现
 */
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

/**
 * 自定义Embeddings类，通过内部API路由调用embeddings服务
 * 避免CORS错误
 */
export class CustomEmbeddings extends Embeddings {
  private embeddingCache = new LRUCache<string, number[]>(100);

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
    let cacheHitCount = 0;

    texts.forEach((text, index) => {
      const cached = this.embeddingCache.get(text);
      if (cached) {
        cacheHitCount++;
        result[index] = cached;
        console.log(`[CustomEmbeddings] 批量缓存命中: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      } else {
        uncachedTexts.push(text);
        uncachedIndices.push(index);
      }
    });

    console.log(`[CustomEmbeddings] 批量请求共 ${texts.length} 个，缓存命中 ${cacheHitCount} 个，需要新生成 ${uncachedTexts.length} 个`);

    if (uncachedTexts.length > 0) {
      console.log(`[CustomEmbeddings] 生成新的embeddings...`);
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
        console.log(`[CustomEmbeddings] 新embedding已缓存: ${uncachedTexts[i].substring(0, 50)}${uncachedTexts[i].length > 50 ? '...' : ''}`);
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
      console.log(`[CustomEmbeddings] 缓存命中: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      return cached;
    }

    console.log(`[CustomEmbeddings] 缓存未命中，生成新的embedding: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
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
    console.log(`[CustomEmbeddings] 新embedding已缓存: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    return embedding;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.embeddingCache.clear();
  }
}
