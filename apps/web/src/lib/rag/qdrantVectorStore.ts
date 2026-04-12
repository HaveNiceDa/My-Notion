import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "@qdrant/js-client-rest";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { extractTextFromDocument } from "@notion/ai/utils";

export class QdrantVectorStoreWrapper {
  private qdrantClient: QdrantClient;
  private userId: string;
  private embeddings: Embeddings;
  private collectionName: string;

  constructor(userId: string, embeddings: Embeddings) {
    this.userId = userId;
    this.embeddings = embeddings;
    // 确保 collection 名称格式正确，避免重复的 "user_" 前缀
    const cleanUserId = userId.replace(/^user_/, "");
    this.collectionName = `user_${cleanUserId}_knowledge_base`;

    this.qdrantClient = new QdrantClient({
      url: process.env.NEXT_PUBLIC_QDRANT_URL?.endsWith(":6333")
        ? process.env.NEXT_PUBLIC_QDRANT_URL
        : `${process.env.NEXT_PUBLIC_QDRANT_URL}:6333`,
      apiKey: process.env.NEXT_PUBLIC_QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }

  async ensureCollectionExists(): Promise<void> {
    try {
      // 验证 Qdrant 客户端配置
      if (!process.env.NEXT_PUBLIC_QDRANT_URL) {
        throw new Error("QDRANT_URL 环境变量未设置");
      }

      if (!process.env.NEXT_PUBLIC_QDRANT_API_KEY) {
        throw new Error("QDRANT_API_KEY 环境变量未设置");
      }

      const collections = await this.qdrantClient.getCollections();

      const exists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!exists) {
        await this.qdrantClient.createCollection(this.collectionName, {
          vectors: {
            size: 1024, // 通义千问嵌入维度
            distance: "Cosine",
          },
        });

        // 为 metadata.documentId 创建关键字索引
        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: "metadata.documentId",
          field_schema: "keyword",
        });

        // 为 metadata.title 创建关键字索引
        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: "metadata.title",
          field_schema: "keyword",
        });
      } else {
        // 尝试为已存在的 collection 添加索引（如果不存在）
        try {
          await this.qdrantClient.createPayloadIndex(this.collectionName, {
            field_name: "metadata.documentId",
            field_schema: "keyword",
          });
        } catch {
          // 索引可能已经存在，忽略错误
        }

        // 尝试为已存在的 collection 添加 title 索引（如果不存在）
        try {
          await this.qdrantClient.createPayloadIndex(this.collectionName, {
            field_name: "metadata.title",
            field_schema: "keyword",
          });
        } catch {
          // 索引可能已经存在，忽略错误
        }
      }
    } catch (error) {
      console.error(`[QdrantVectorStore] 确保 collection 存在时出错:`, error);
      throw error;
    }
  }

  async similaritySearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      // 内部调用混合检索方法以提供更好的搜索结果
      return await this.hybridSearch(query, k, minScore, excludeDocumentIds);
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行语义检索时出错:`, error);
      throw error;
    }
  }

  async hybridSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      await this.ensureCollectionExists();

      const queryVector = await this.embeddings.embedQuery(query);

      const filter: any = {};
      if (excludeDocumentIds && excludeDocumentIds.size > 0) {
        filter.must_not = Array.from(excludeDocumentIds).map((id) => ({
          key: "metadata.documentId",
          match: { value: id },
        }));
      }

      const searchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: queryVector,
          limit: k * 3,
          filter: filter.must_not ? filter : undefined,
          params: {
            hnsw_ef: 128,
            exact: false,
          },
        },
      );

      const documentMap = new Map<
        string,
        { document: Document; score: number }
      >();

      searchResults.forEach((result: any) => {
        const document = new Document({
          pageContent: (result.payload?.pageContent as string) || "",
          metadata: (result.payload?.metadata as any) || {},
        });

        const documentId = document.metadata?.documentId;
        if (documentId) {
          if (
            !documentMap.has(documentId) ||
            result.score > documentMap.get(documentId)!.score
          ) {
            documentMap.set(documentId, {
              document,
              score: result.score || 0,
            });
          }
        } else {
          // 使用时间戳和随机数组合避免 key 冲突
          const uniqueKey = `no_id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          documentMap.set(uniqueKey, {
            document,
            score: result.score || 0,
          });
        }
      });

      let filteredResults = Array.from(documentMap.values())
        .filter((result) => result.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      return filteredResults;
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行语义检索时出错:`, error);
      throw error;
    }
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
  ): Promise<void> {
    await this.ensureCollectionExists();

    // 准备点数据
    const points = chunks.map((chunk, index) => ({
      // 使用无符号整数作为点 ID，符合 Qdrant 的要求
      id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      vector: chunk.embedding,
      payload: {
        pageContent: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          userId,
          documentId,
          chunkIndex: chunk.chunkIndex,
        },
      },
    }));

    // 批量上传点
    try {
      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points,
      });
    } catch (error: any) {
      console.error(`[QdrantVectorStore] 上传 chunks 时出错:`, error);
      console.error(
        `[QdrantVectorStore] 错误详情:`,
        error.response?.data || error.data || error.message,
      );
      throw error;
    }
  }

  async updateDocument(
    userId: string,
    documentId: string,
    content: string,
    title: string,
  ): Promise<void> {
    await this.ensureCollectionExists();

    // 首先删除旧的文档 chunks
    await this.deleteDocumentChunks(documentId);

    // 提取明文内容
    const plainTextContent = extractTextFromDocument(content);
    if (!plainTextContent) {
      return;
    }

    // 创建文本分割器
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 250,
      chunkOverlap: 40,
      separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
    });

    // 分割文档
    const splits = await textSplitter.splitText(plainTextContent);

    // 生成嵌入
    const embeddingResults = await this.embeddings.embedDocuments(splits);

    // 创建 chunks
    const chunks = splits.map((split, index) => ({
      chunkIndex: index,
      pageContent: split,
      metadata: { documentId, title },
      embedding: embeddingResults[index],
    }));

    // 添加新的 chunks
    await this.addDocumentChunks(userId, documentId, chunks);
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.ensureCollectionExists();

    try {
      // 使用正确的删除语法
      await this.qdrantClient.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: "metadata.documentId",
              match: {
                value: documentId,
              },
            },
          ],
        },
        wait: true,
      });
    } catch (error: any) {
      console.error(`[QdrantVectorStore] 删除文档 chunks 时出错:`, error);
      console.error(
        `[QdrantVectorStore] 错误详情:`,
        error.response?.data || error.data || error.message,
      );
      throw error;
    }
  }

  async needsReembedding(
    documentId: string,
    content: string,
  ): Promise<boolean> {
    await this.ensureCollectionExists();

    try {
      // 使用 count 方法检查文档是否存在
      const countResult = await this.qdrantClient.count(this.collectionName, {
        filter: {
          must: [
            {
              key: "metadata.documentId",
              match: {
                value: documentId,
              },
            },
          ],
        },
      });

      // 如果没有找到文档，则需要重新嵌入
      return countResult.count === 0;
    } catch (error) {
      console.error(`[QdrantVectorStore] 检查是否需要重新嵌入时出错:`, error);
      return true; // 出错时默认需要重新嵌入
    }
  }

  async getDocumentsCount(): Promise<number> {
    await this.ensureCollectionExists();

    try {
      const collectionInfo = await this.qdrantClient.getCollection(
        this.collectionName,
      );
      return collectionInfo.points_count || 0;
    } catch (error) {
      console.error(`[QdrantVectorStore] 获取文档数量时出错:`, error);
      return 0;
    }
  }
}
