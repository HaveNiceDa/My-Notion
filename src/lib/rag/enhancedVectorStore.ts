import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { extractTextFromDocument } from "./rag";

const computeContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

interface DocumentChunk {
  _id: string;
  userId: string;
  documentId: string;
  chunkIndex: number;
  embedding: number[];
  pageContent: string;
  metadata: {
    title: string;
    documentId: string;
  };
  contentHash: string;
  createdAt: number;
}

interface InMemoryDocument {
  pageContent: string;
  metadata: any;
  embedding: number[];
}

export class EnhancedVectorStore {
  private convex: ConvexHttpClient;
  private userId: string;
  private embeddings: Embeddings;
  public documents: InMemoryDocument[] = [];
  private isLoaded = false;

  constructor(
    convex: ConvexHttpClient,
    userId: string,
    embeddings: Embeddings,
  ) {
    this.convex = convex;
    this.userId = userId;
    this.embeddings = embeddings;
  }

  async loadFromConvex(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    const chunks = await this.convex.query(api.vectorStore.getUserChunks, {
      userId: this.userId,
    });

    this.documents = chunks.map((chunk: DocumentChunk) => ({
      pageContent: chunk.pageContent,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
    }));

    this.isLoaded = true;
  }

  async needsReembedding(
    documentId: string,
    content: string,
  ): Promise<boolean> {
    const contentHash = computeContentHash(content);
    return await this.convex.query(api.vectorStore.needsReembedding, {
      documentId: documentId as any,
      contentHash,
    });
  }

  async addDocumentChunks(
    userId: string,
    documentId: string,
    chunks: Array<{
      chunkIndex: number;
      pageContent: string;
      metadata: any;
      embedding: number[];
    }>,
  ): Promise<string[]> {
    const contentHash = computeContentHash(
      chunks.map((c) => c.pageContent).join("\n"),
    );

    const result = await this.convex.mutation(api.vectorStore.embedDocument, {
      userId,
      documentId: documentId as any,
      contentHash,
      chunks,
    });

    this.isLoaded = false;
    await this.loadFromConvex();

    return result.chunkCount
      .toString()
      .split("")
      .map(() => "");
  }

  async updateDocument(
    userId: string,
    documentId: string,
    content: string,
    title: string,
    embeddings: Embeddings,
    textSplitter: any,
  ): Promise<void> {
    console.log(
      `[EnhancedVectorStore] 更新文档: documentId=${documentId}, title=${title}`,
    );

    const contentHash = computeContentHash(content);
    const needsReembed = await this.needsReembedding(
      documentId as any,
      content,
    );

    if (!needsReembed) {
      console.log(`[EnhancedVectorStore] 文档内容未变化，无需更新: ${title}`);
      return;
    }

    console.log(`[EnhancedVectorStore] 开始重新嵌入文档: ${title}`);

    // 提取明文内容
    const plainTextContent = extractTextFromDocument(content);
    if (!plainTextContent) {
      console.log(`[EnhancedVectorStore] 文档无有效内容，跳过更新: ${title}`);
      return;
    }
    console.log(
      `[EnhancedVectorStore] 提取明文内容完成，长度: ${plainTextContent.length} 字符`,
    );

    const splits = await textSplitter.splitText(plainTextContent);
    console.log(
      `[EnhancedVectorStore] 文档 "${title}" 分割为 ${splits.length} 个chunks`,
    );

    const embeddingResults = await embeddings.embedDocuments(splits);
    const chunks = splits.map((split: string, index: number) => ({
      chunkIndex: index,
      pageContent: split,
      metadata: { documentId, title },
      embedding: embeddingResults[index],
    }));

    await this.addDocumentChunks(userId, documentId, chunks);
    console.log(`[EnhancedVectorStore] 文档更新完成: ${title}`);
  }

  async similaritySearch(
    query: string,
    k: number = 4,
    minScore: number = 0,
  ): Promise<Array<{ document: Document; score: number }>> {
    // 直接使用内存中的chunk，不再从数据库加载
    console.log(`[EnhancedVectorStore] 使用内存中的 ${this.documents.length} 个chunk进行相似度检索`);

    const queryEmbedding = await this.embeddings.embedQuery(query);

    const similarities = this.documents.map((doc) => ({
      document: new Document({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      }),
      score: this.cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    return similarities
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score >= minScore)
      .slice(0, k);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }
}
