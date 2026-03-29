import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "@qdrant/js-client-rest";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { extractTextFromDocument } from "@/src/lib/utils/textExtractor";

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

        // 为 metadata.title 创建关键字索引
        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: "metadata.title",
          field_schema: "keyword",
        });

        console.log(
          `[QdrantVectorStore] 创建了新的 collection: ${this.collectionName}，并为 metadata.documentId 和 metadata.title 创建了索引`,
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

        // 尝试为已存在的 collection 添加 title 索引（如果不存在）
        try {
          await this.qdrantClient.createPayloadIndex(this.collectionName, {
            field_name: "metadata.title",
            field_schema: "keyword",
          });
          console.log(`[QdrantVectorStore] 为 metadata.title 创建了索引`);
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
    try {
      // 内部调用混合检索方法以提供更好的搜索结果
      console.log(
        `[QdrantVectorStore] similaritySearch 调用 hybridSearch: ${query}`,
      );
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
    titleBoost: number = 1.5,
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      await this.ensureCollectionExists();

      console.log(`[QdrantVectorStore] 执行混合检索: ${query}`);

      // 生成查询向量
      const queryVector = await this.embeddings.embedQuery(query);
      // 生成 title 专用查询向量（使用相同的查询文本，但在搜索时会优先匹配 title）
      const titleQueryVector = await this.embeddings.embedQuery(
        `title: ${query}`,
      );

      // 构建过滤条件
      const filter: any = {};
      if (excludeDocumentIds && excludeDocumentIds.size > 0) {
        filter.must_not = Array.from(excludeDocumentIds).map((id) => ({
          key: "metadata.documentId",
          match: { value: id },
        }));
      }

      // 1. 向量搜索 - 基础相关性（内容匹配）
      const contentSearchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: queryVector,
          limit: k * 3, // 获取更多结果以进行混合
          filter: filter.must_not ? filter : undefined,
          params: {
            hnsw_ef: 128,
            exact: false,
          },
        },
      );

      // 2. Title 向量搜索 - 优先匹配标题
      const titleSearchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: titleQueryVector,
          limit: k * 3,
          filter: filter.must_not ? filter : undefined,
          params: {
            hnsw_ef: 128,
            exact: false,
          },
        },
      );

      // 3. 关键词搜索 - 精确匹配 title
      const keywordSearchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: queryVector,
          limit: k * 3,
          filter: {
            ...(filter.must_not ? { must_not: filter.must_not } : {}),
            must: [
              {
                key: "metadata.title",
                match: {
                  value: query,
                },
              },
            ],
          },
          params: {
            hnsw_ef: 128,
            exact: false,
          },
        },
      );

      // 4. 合并结果并计算最终分数
      const resultMap = new Map<
        string,
        { document: Document; score: number }
      >();

      // 处理内容搜索结果
      contentSearchResults.forEach((result: any) => {
        const id = result.id.toString();
        const document = new Document({
          pageContent: (result.payload?.pageContent as string) || "",
          metadata: (result.payload?.metadata as any) || {},
        });
        resultMap.set(id, {
          document,
          score: result.score || 0,
        });
      });

      // 处理 title 向量搜索结果（增强 title 相关性）
      titleSearchResults.forEach((result: any) => {
        const id = result.id.toString();
        const document = new Document({
          pageContent: (result.payload?.pageContent as string) || "",
          metadata: (result.payload?.metadata as any) || {},
        });

        if (resultMap.has(id)) {
          // 增强 title 匹配的分数
          const existing = resultMap.get(id)!;
          resultMap.set(id, {
            document,
            score: existing.score + (result.score || 0) * 0.5, // title 向量匹配的额外分数
          });
        } else {
          // 新的结果，直接添加
          resultMap.set(id, {
            document,
            score: (result.score || 0) * 0.8, // 纯 title 匹配的基础分数
          });
        }
      });

      // 处理关键词搜索结果（精确 title 匹配）
      keywordSearchResults.forEach((result: any) => {
        const id = result.id.toString();
        const document = new Document({
          pageContent: (result.payload?.pageContent as string) || "",
          metadata: (result.payload?.metadata as any) || {},
        });

        if (resultMap.has(id)) {
          // 大幅增强精确 title 匹配的分数
          const existing = resultMap.get(id)!;
          resultMap.set(id, {
            document,
            score: existing.score * titleBoost, // 精确 title 匹配的大幅增强
          });
        } else {
          // 新的结果，直接添加
          resultMap.set(id, {
            document,
            score: (result.score || 0) * titleBoost, // 纯精确 title 匹配的分数
          });
        }
      });

      // 5. 进一步优化：检查文档标题与查询的相似度
      const finalResults = Array.from(resultMap.values()).map((item) => {
        const document = item.document;
        let finalScore = item.score;

        // 如果文档有标题，进一步评估标题与查询的相关性
        if (document.metadata?.title) {
          const title = document.metadata.title.toLowerCase();
          const queryLower = query.toLowerCase();

          // 精确匹配标题
          if (title === queryLower) {
            finalScore *= 2.0; // 最高优先级
          }
          // 标题包含查询
          else if (title.includes(queryLower)) {
            finalScore *= 1.5; // 高优先级
          }
          // 查询包含标题关键词
          else if (queryLower.includes(title)) {
            finalScore *= 1.2; // 中等优先级
          }
        }

        return {
          document,
          score: finalScore,
        };
      });

      // 6. 按文档去重：每个文档只保留最高分的chunk
      const documentMap = new Map<
        string,
        { document: Document; score: number }
      >();

      finalResults.forEach((result) => {
        const documentId = result.document.metadata?.documentId;
        if (documentId) {
          if (
            !documentMap.has(documentId) ||
            result.score > documentMap.get(documentId)!.score
          ) {
            // 限制分数最高为0.99
            const cappedScore = Math.min(result.score, 0.99);
            documentMap.set(documentId, {
              document: result.document,
              score: cappedScore,
            });
          }
        } else {
          // 没有documentId的结果直接保留
          const cappedScore = Math.min(result.score, 0.99);
          documentMap.set(`no_id_${Math.random()}`, {
            document: result.document,
            score: cappedScore,
          });
        }
      });

      // 转换为数组并排序
      let filteredResults = Array.from(documentMap.values())
        .filter((result) => result.score >= minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);

      console.log(
        `[QdrantVectorStore] 混合检索找到 ${filteredResults.length} 个相关文档`,
      );
      return filteredResults;
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行混合检索时出错:`, error);
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
      // 直接查询是否存在该文档的任何向量
      const searchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: Array(1024).fill(0), // 使用零向量作为占位符
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
