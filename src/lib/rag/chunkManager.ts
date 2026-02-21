import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

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

export interface InMemoryDocument {
  pageContent: string;
  metadata: any;
  embedding: number[];
}

export class ChunkManager {
  private static instance: ChunkManager;
  private convex: ConvexHttpClient;
  private chunks: Map<string, InMemoryDocument[]> = new Map(); // userId -> chunks
  private isLoaded: Map<string, boolean> = new Map(); // userId -> isLoaded

  private constructor() {
    this.convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  }

  public static getInstance(): ChunkManager {
    if (!ChunkManager.instance) {
      ChunkManager.instance = new ChunkManager();
    }
    return ChunkManager.instance;
  }

  async loadChunksForUser(userId: string): Promise<InMemoryDocument[]> {
    if (this.isLoaded.get(userId) && this.chunks.has(userId)) {
      return this.chunks.get(userId)!;
    }

    console.log(`[ChunkManager] 首次加载用户 ${userId} 的chunk...`);
    const chunks = await this.convex.query(api.vectorStore.getUserChunks, {
      userId,
    });

    const inMemoryChunks = chunks.map((chunk: DocumentChunk) => ({
      pageContent: chunk.pageContent,
      metadata: chunk.metadata,
      embedding: chunk.embedding,
    }));

    this.chunks.set(userId, inMemoryChunks);
    this.isLoaded.set(userId, true);

    console.log(`[ChunkManager] 加载完成，共 ${inMemoryChunks.length} 个chunk`);
    return inMemoryChunks;
  }

  getChunksForUser(userId: string): InMemoryDocument[] {
    return this.chunks.get(userId) || [];
  }

  addChunksForUser(userId: string, newChunks: InMemoryDocument[]): void {
    const existingChunks = this.chunks.get(userId) || [];
    this.chunks.set(userId, [...existingChunks, ...newChunks]);
    console.log(`[ChunkManager] 为用户 ${userId} 添加了 ${newChunks.length} 个chunk`);
  }

  removeChunksByDocumentId(userId: string, documentId: string): void {
    const chunks = this.chunks.get(userId) || [];
    const filteredChunks = chunks.filter(
      (chunk) => chunk.metadata.documentId !== documentId
    );
    this.chunks.set(userId, filteredChunks);
    console.log(
      `[ChunkManager] 为用户 ${userId} 删除了文档 ${documentId} 的chunk`
    );
  }

  async removeChunksByDocumentIdAndRefresh(userId: string, documentId: string): Promise<void> {
    this.removeChunksByDocumentId(userId, documentId);
    await this.refreshChunksForUser(userId);
    console.log(
      `[ChunkManager] 为用户 ${userId} 删除了文档 ${documentId} 的chunk并刷新了数据`
    );
  }

  clearChunksForUser(userId: string): void {
    this.chunks.set(userId, []);
    this.isLoaded.set(userId, false);
    console.log(`[ChunkManager] 清除了用户 ${userId} 的所有chunk`);
  }

  async refreshChunksForUser(userId: string): Promise<void> {
    this.isLoaded.set(userId, false);
    await this.loadChunksForUser(userId);
  }
}
