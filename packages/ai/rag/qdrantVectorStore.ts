import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "@qdrant/js-client-rest";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { extractTextFromDocument } from "../utils";

export class QdrantVectorStoreWrapper {
  private qdrantClient: QdrantClient;
  private userId: string;
  private embeddings: Embeddings;
  private collectionName: string;

  constructor(userId: string, embeddings: Embeddings) {
    this.userId = userId;
    this.embeddings = embeddings;
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
            size: 1024,
            distance: "Cosine",
          },
        });

        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: "metadata.documentId",
          field_schema: "keyword",
        });

        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: "metadata.title",
          field_schema: "keyword",
        });

        await this.qdrantClient.createPayloadIndex(this.collectionName, {
          field_name: "metadata.contentHash",
          field_schema: "keyword",
        });
      } else {
        for (const field of ["metadata.documentId", "metadata.title", "metadata.contentHash"]) {
          try {
            await this.qdrantClient.createPayloadIndex(this.collectionName, {
              field_name: field,
              field_schema: "keyword",
            });
          } catch {
          }
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

      type QdrantSearchResult = { payload?: Record<string, unknown> | null; score: number };
      searchResults.forEach((result: QdrantSearchResult) => {
        const document = new Document({
          pageContent: (result.payload?.pageContent as string) || "",
          metadata: (result.payload?.metadata as Record<string, unknown>) || {},
        });

        const documentId = document.metadata?.documentId as string | undefined;
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
    contentHash?: string,
  ): Promise<void> {
    await this.ensureCollectionExists();

    const points = chunks.map((chunk, index) => ({
      id: Math.floor(Math.random() * Number.MAX_SAFE_INTEGER),
      vector: chunk.embedding,
      payload: {
        pageContent: chunk.pageContent,
        metadata: {
          ...chunk.metadata,
          userId,
          documentId,
          chunkIndex: chunk.chunkIndex,
          ...(contentHash ? { contentHash } : {}),
        },
      },
    }));

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
    contentHash?: string,
  ): Promise<void> {
    await this.ensureCollectionExists();

    await this.deleteDocumentChunks(documentId);

    const plainTextContent = extractTextFromDocument(content);
    if (!plainTextContent) {
      return;
    }

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 250,
      chunkOverlap: 40,
      separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
    });

    const splits = await textSplitter.splitText(plainTextContent);

    const embeddingResults = await this.embeddings.embedDocuments(splits);

    const chunks = splits.map((split, index) => ({
      chunkIndex: index,
      pageContent: split,
      metadata: { documentId, title },
      embedding: embeddingResults[index],
    }));

    await this.addDocumentChunks(userId, documentId, chunks, contentHash);
  }

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await this.ensureCollectionExists();

    try {
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
    contentHash?: string,
  ): Promise<boolean> {
    await this.ensureCollectionExists();

    try {
      if (contentHash) {
        const scrollResult = await this.qdrantClient.scroll(
          this.collectionName,
          {
            filter: {
              must: [
                {
                  key: "metadata.documentId",
                  match: { value: documentId },
                },
                {
                  key: "metadata.contentHash",
                  match: { value: contentHash },
                },
              ],
            },
            limit: 1,
          },
        );

        if (scrollResult.points.length > 0) {
          return false;
        }

        const countResult = await this.qdrantClient.count(
          this.collectionName,
          {
            filter: {
              must: [
                {
                  key: "metadata.documentId",
                  match: { value: documentId },
                },
              ],
            },
          },
        );

        return countResult.count > 0;
      }

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

      return countResult.count === 0;
    } catch (error) {
      console.error(`[QdrantVectorStore] 检查是否需要重新嵌入时出错:`, error);
      return true;
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
