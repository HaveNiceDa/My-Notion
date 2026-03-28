import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "@qdrant/js-client-rest";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
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
      url: process.env.NEXT_PUBLIC_QDRANT_URL,
      apiKey: process.env.NEXT_PUBLIC_QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }

  async ensureCollectionExists(): Promise<void> {
    try {
      console.log(
        `[QdrantVectorStore] 确保 collection 存在: ${this.collectionName}`,
      );
      console.log(
        `[QdrantVectorStore] Qdrant URL: ${process.env.NEXT_PUBLIC_QDRANT_URL}`,
      );

      // 验证 Qdrant 客户端配置
      if (!process.env.NEXT_PUBLIC_QDRANT_URL) {
        throw new Error("QDRANT_URL 环境变量未设置");
      }

      if (!process.env.NEXT_PUBLIC_QDRANT_API_KEY) {
        throw new Error("QDRANT_API_KEY 环境变量未设置");
      }

      const collections = await this.qdrantClient.getCollections();
      console.log(
        `[QdrantVectorStore] 现有 collections: ${collections.collections.map((c) => c.name).join(", ")}`,
      );

      const exists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!exists) {
        console.log(
          `[QdrantVectorStore] 创建新的 collection: ${this.collectionName}`,
        );
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

        console.log(
          `[QdrantVectorStore] 创建了新的 collection: ${this.collectionName}，并为 metadata.documentId 创建了索引`,
        );
      } else {
        console.log(
          `[QdrantVectorStore] Collection 已存在: ${this.collectionName}`,
        );

        // 尝试为已存在的 collection 添加索引（如果不存在）
        try {
          await this.qdrantClient.createPayloadIndex(this.collectionName, {
            field_name: "metadata.documentId",
            field_schema: "keyword",
          });
          console.log(`[QdrantVectorStore] 为 metadata.documentId 创建了索引`);
        } catch (error) {
          // 索引可能已经存在，忽略错误
          console.log(`[QdrantVectorStore] 索引可能已经存在，忽略错误:`, error);
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
    await this.ensureCollectionExists();

    console.log(`[QdrantVectorStore] 执行语义检索: ${query}`);

    // 生成查询向量
    const queryVector = await this.embeddings.embedQuery(query);

    // 构建过滤条件
    const filter: any = {};
    if (excludeDocumentIds && excludeDocumentIds.size > 0) {
      filter.must_not = Array.from(excludeDocumentIds).map((id) => ({
        key: "metadata.documentId",
        match: { value: id },
      }));
    }

    // 使用 QdrantClient 进行搜索
    const searchResults = await this.qdrantClient.search(this.collectionName, {
      vector: queryVector,
      limit: k * 2, // 获取更多结果以进行过滤
      filter: filter.must_not ? filter : undefined,
      params: {
        hnsw_ef: 128,
        exact: false,
      },
    });

    // 转换结果
    let filteredResults = searchResults.map((result: any) => ({
      document: new Document({
        pageContent: (result.payload?.pageContent as string) || "",
        metadata: (result.payload?.metadata as any) || {},
      }),
      score: result.score || 0,
    }));

    // 应用最小得分阈值
    filteredResults = filteredResults.filter(
      (result: any) => result.score >= minScore,
    );

    console.log(
      `[QdrantVectorStore] 语义检索找到 ${filteredResults.length} 个相关文档`,
    );
    return filteredResults;
  }

  async keywordSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    await this.ensureCollectionExists();

    console.log(`[QdrantVectorStore] 执行关键词检索: ${query}`);

    // 构建过滤条件
    const filter: any = {};
    if (excludeDocumentIds && excludeDocumentIds.size > 0) {
      filter.must_not = Array.from(excludeDocumentIds).map((id) => ({
        key: "metadata.documentId",
        match: { value: id },
      }));
    }

    // 使用 Qdrant 的搜索功能（基于向量相似性）
    // 注意：Qdrant 不直接支持纯关键词搜索，这里使用向量搜索作为替代
    const queryVector = await this.embeddings.embedQuery(query);

    const searchResults = await this.qdrantClient.search(this.collectionName, {
      vector: queryVector,
      limit: k * 2, // 获取更多结果以进行过滤
      filter: filter.must_not ? filter : undefined,
      params: {
        hnsw_ef: 128,
        exact: false,
      },
    });

    let results = searchResults.map((result: any) => ({
      document: new Document({
        pageContent: (result.payload?.pageContent as string) || "",
        metadata: (result.payload?.metadata as any) || {},
      }),
      score: result.score || 0,
    }));

    // 应用最小得分阈值
    results = results.filter((result: any) => result.score >= minScore);

    console.log(
      `[QdrantVectorStore] 关键词检索找到 ${results.length} 个相关文档`,
    );
    return results;
  }

  async hybridSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    semanticWeight: number = 0.5,
  ): Promise<Array<{ document: Document; score: number }>> {
    await this.ensureCollectionExists();

    console.log(`[QdrantVectorStore] 执行混合检索: ${query}`);

    // 并行执行语义检索和关键词检索
    const [semanticResults, keywordResults] = await Promise.all([
      this.similaritySearch(query, k * 4, minScore * 0.8),
      this.keywordSearch(query, k * 4, minScore * 0.8),
    ]);

    // 结果融合
    const documentMap = new Map<
      string,
      { document: Document; semanticScore: number; keywordScore: number }
    >();

    // 处理语义检索结果
    for (const result of semanticResults) {
      const metadata = result.document.metadata || {};
      const docKey =
        (metadata.documentId || "") +
        "_" +
        result.document.pageContent.substring(0, 150).replace(/\s+/g, "");
      documentMap.set(docKey, {
        document: result.document,
        semanticScore: result.score,
        keywordScore: 0,
      });
    }

    // 处理关键词检索结果
    for (const result of keywordResults) {
      const metadata = result.document.metadata || {};
      const docKey =
        (metadata.documentId || "") +
        "_" +
        result.document.pageContent.substring(0, 150).replace(/\s+/g, "");
      if (documentMap.has(docKey)) {
        const existing = documentMap.get(docKey)!;
        existing.keywordScore = result.score;
      } else {
        documentMap.set(docKey, {
          document: result.document,
          semanticScore: 0,
          keywordScore: result.score,
        });
      }
    }

    // 计算最终得分
    const fusedResults = Array.from(documentMap.values()).map((item) => {
      const score =
        item.semanticScore * semanticWeight +
        item.keywordScore * (1 - semanticWeight);
      return {
        document: item.document,
        score,
      };
    });

    // 排序并限制数量
    const sortedResults = fusedResults
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score >= minScore)
      .slice(0, k);

    console.log(
      `[QdrantVectorStore] 混合检索找到 ${sortedResults.length} 个相关文档`,
    );
    return sortedResults;
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
    await this.ensureCollectionExists();

    console.log(`[QdrantVectorStore] 添加文档 chunks: ${documentId}`);

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
      console.log(
        `[QdrantVectorStore] 上传 ${points.length} 个 chunks，第一个 chunk 的向量维度: ${points[0].vector.length}`,
      );
      console.log(`[QdrantVectorStore] 第一个 chunk 的 id: ${points[0].id}`);
      console.log(
        `[QdrantVectorStore] 第一个 chunk 的 pageContent 长度: ${points[0].payload.pageContent.length}`,
      );

      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points,
      });

      console.log(`[QdrantVectorStore] 成功添加 ${points.length} 个 chunks`);
    } catch (error: any) {
      console.error(`[QdrantVectorStore] 上传 chunks 时出错:`, error);
      console.error(
        `[QdrantVectorStore] 错误详情:`,
        error.response?.data || error.data || error.message,
      );
      throw error;
    }

    return points.map(() => "");
  }

  async updateDocument(
    userId: string,
    documentId: string,
    content: string,
    title: string,
  ): Promise<void> {
    await this.ensureCollectionExists();

    console.log(`[QdrantVectorStore] 更新文档: ${documentId}, ${title}`);

    // 首先删除旧的文档 chunks
    await this.deleteDocumentChunks(documentId);

    // 提取明文内容
    const plainTextContent = extractTextFromDocument(content);
    if (!plainTextContent) {
      console.log(`[QdrantVectorStore] 文档无有效内容，跳过更新: ${title}`);
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
    console.log(`[QdrantVectorStore] 文档分割为 ${splits.length} 个 chunks`);

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
    console.log(`[QdrantVectorStore] 文档更新完成: ${title}`);
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.ensureCollectionExists();

    console.log(`[QdrantVectorStore] 删除文档 chunks: ${documentId}`);

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
      console.log(`[QdrantVectorStore] 成功删除文档 ${documentId} 的 chunks`);
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
      // 生成查询向量
      const queryVector = await this.embeddings.embedQuery(
        content.substring(0, 100),
      );

      const searchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: queryVector,
          limit: 1,
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
        },
      );

      // 如果没有找到文档，则需要重新嵌入
      return searchResults.length === 0;
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
