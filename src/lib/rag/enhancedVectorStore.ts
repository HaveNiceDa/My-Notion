import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const computeContentHash = (content: string): string => {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
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
  private documents: InMemoryDocument[] = [];
  private isLoaded = false;

  constructor(convex: ConvexHttpClient, userId: string, embeddings: Embeddings) {
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

    return result.chunkCount.toString().split("").map(() => "");
  }

  async similaritySearch(
    query: string,
    k: number = 4,
    minScore: number = 0,
  ): Promise<Array<{ document: Document; score: number }>> {
    await this.loadFromConvex();

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
