import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { extractTextFromDocument } from "./rag";

// 客户端 Qdrant 向量存储包装器，通过 API 路由调用 Qdrant 操作
export class QdrantVectorStoreClient {
  private userId: string;
  private embeddings: Embeddings;

  constructor(userId: string, embeddings: Embeddings) {
    this.userId = userId;
    this.embeddings = embeddings;
  }

  private async callApi(action: string, params: any = {}) {
    const response = await fetch("/api/qdrant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        userId: this.userId,
        ...params,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "API call failed");
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "API call failed");
    }

    return data;
  }

  async ensureCollectionExists(): Promise<void> {
    await this.callApi("ensureCollectionExists");
  }

  async similaritySearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    const data = await this.callApi("similaritySearch", {
      query,
      k,
      minScore,
      excludeDocumentIds: excludeDocumentIds
        ? Array.from(excludeDocumentIds)
        : undefined,
    });

    // 将返回的文档数据转换为 Document 对象
    return data.results.map((result: any) => ({
      document: new Document({
        pageContent: result.document.pageContent,
        metadata: result.document.metadata,
      }),
      score: result.score,
    }));
  }

  async keywordSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    const data = await this.callApi("keywordSearch", {
      query,
      k,
      minScore,
      excludeDocumentIds: excludeDocumentIds
        ? Array.from(excludeDocumentIds)
        : undefined,
    });

    return data.results.map((result: any) => ({
      document: new Document({
        pageContent: result.document.pageContent,
        metadata: result.document.metadata,
      }),
      score: result.score,
    }));
  }

  async hybridSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    semanticWeight: number = 0.5,
  ): Promise<Array<{ document: Document; score: number }>> {
    const data = await this.callApi("hybridSearch", {
      query,
      k,
      minScore,
      semanticWeight,
    });

    return data.results.map((result: any) => ({
      document: new Document({
        pageContent: result.document.pageContent,
        metadata: result.document.metadata,
      }),
      score: result.score,
    }));
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
    const data = await this.callApi("addDocumentChunks", {
      documentId,
      chunks,
    });

    return data.result;
  }

  async updateDocument(
    userId: string,
    documentId: string,
    content: string,
    title: string,
    embeddings: Embeddings,
    textSplitter: RecursiveCharacterTextSplitter,
  ): Promise<void> {
    // 在客户端处理文档更新
    // 首先删除旧的文档 chunks
    await this.deleteDocumentChunks(documentId);

    // 提取明文内容
    const plainTextContent = extractTextFromDocument(content);
    if (!plainTextContent) {
      console.log(
        `[QdrantVectorStoreClient] 文档无有效内容，跳过更新: ${title}`,
      );
      return;
    }

    // 分割文档
    const splits = await textSplitter.splitText(plainTextContent);
    console.log(
      `[QdrantVectorStoreClient] 文档分割为 ${splits.length} 个 chunks`,
    );

    // 生成嵌入
    const embeddingResults = await embeddings.embedDocuments(splits);

    // 创建 chunks
    const chunks = splits.map((split, index) => ({
      chunkIndex: index,
      pageContent: split,
      metadata: { documentId, title },
      embedding: embeddingResults[index],
    }));

    // 添加新的 chunks
    await this.addDocumentChunks(userId, documentId, chunks);
    console.log(`[QdrantVectorStoreClient] 文档更新完成: ${title}`);
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.callApi("deleteDocumentChunks", {
      documentId,
    });
  }

  async needsReembedding(
    documentId: string,
    content: string,
  ): Promise<boolean> {
    const data = await this.callApi("needsReembedding", {
      documentId,
      content,
    });

    return data.needsReembed;
  }

  async getDocumentsCount(): Promise<number> {
    const data = await this.callApi("getDocumentsCount");
    return data.count;
  }
}
