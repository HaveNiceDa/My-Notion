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

  async similaritySearch(
    query: string,
    k: number = 4
  ): Promise<Document[]> {
    console.log('SimpleVectorStore - 开始相似度搜索，文档数量:', this.documents.length);
    console.log('SimpleVectorStore - 查询文本:', query);
    
    if (this.documents.length === 0) {
      console.log('SimpleVectorStore - 文档数组为空，返回空结果');
      return [];
    }
    
    const queryEmbedding = await this.embeddings.embedQuery(query);
    console.log('SimpleVectorStore - 查询向量生成完成，维度:', queryEmbedding.length);
    
    const similarities = this.documents.map((doc) => ({
      document: doc,
      similarity: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    similarities.sort((a, b) => b.similarity - a.similarity);
    
    console.log('SimpleVectorStore - 相似度排序完成，前', k, '个结果:');
    for (let i = 0; i < Math.min(k, similarities.length); i++) {
      console.log(`SimpleVectorStore - 结果 ${i + 1} 相似度:`, similarities[i].similarity);
      console.log(`SimpleVectorStore - 结果 ${i + 1} 内容预览:`, similarities[i].document.pageContent.substring(0, 50) + '...');
    }
    
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