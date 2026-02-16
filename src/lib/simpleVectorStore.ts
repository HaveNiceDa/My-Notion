import { Embeddings } from "@langchain/core/embeddings";

interface Document {
  pageContent: string;
  metadata?: Record<string, any>;
}

interface VectorDocument extends Document {
  embedding: number[];
}

/**
 * 简单的内存向量存储实现
 * 适合开发环境使用
 */
export class SimpleVectorStore {
  private documents: VectorDocument[] = [];
  private embeddings: Embeddings;

  constructor(embeddings: Embeddings) {
    this.embeddings = embeddings;
  }

  async addDocuments(documents: Document[]): Promise<void> {
    for (const doc of documents) {
      const embedding = await this.embeddings.embedQuery(doc.pageContent);
      this.documents.push({
        ...doc,
        embedding,
      });
    }
  }

  async similaritySearch(query: string, k: number = 4): Promise<Document[]> {
    if (this.documents.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddings.embedQuery(query);

    const similarities = this.documents.map((doc) => ({
      document: doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);

    return similarities.slice(0, k).map((item) => item.document);
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
