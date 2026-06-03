import { Embeddings } from "@langchain/core/embeddings";
import { Document } from "@langchain/core/documents";
import { QdrantClient } from "@qdrant/js-client-rest";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

import { extractTextFromDocument } from "../utils";

interface SemanticSearchFilters {
  includeDocumentIds?: string[];
  excludeDocumentIds?: string[];
}

interface DocumentIndexMetadata {
  updatedAt?: number;
  tags?: string[];
  documentPath?: string[];
}

interface AgentMemoryIndexItem {
  id: string;
  type: string;
  kind?: string;
  category?: string;
  scopeLevel?: string;
  scopeKey?: string;
  content: string;
  summary?: string;
  reason?: string;
  confidence?: number;
  importance?: number;
  source?: string;
  updatedAt?: number;
}

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

        for (const { field, schema } of payloadIndexDefinitions()) {
          await this.qdrantClient.createPayloadIndex(this.collectionName, {
            field_name: field,
            field_schema: schema,
          });
        }
      } else {
        for (const { field, schema } of payloadIndexDefinitions()) {
          try {
            await this.qdrantClient.createPayloadIndex(this.collectionName, {
              field_name: field,
              field_schema: schema,
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
      return await this.semanticSearch(query, k, minScore, {
        excludeDocumentIds: excludeDocumentIds ? Array.from(excludeDocumentIds) : undefined,
      });
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行语义检索时出错:`, error);
      throw error;
    }
  }

  async semanticSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    filters?: SemanticSearchFilters,
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      return await this.hybridSearch(query, k, minScore, filters);
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行语义检索时出错:`, error);
      throw error;
    }
  }

  async hybridSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    filters?: SemanticSearchFilters | Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      await this.ensureCollectionExists();

      const queryVector = await this.embeddings.embedQuery(query);
      const normalizedFilters = normalizeSemanticFilters(filters);
      const filter = buildSemanticFilter(normalizedFilters);

      const searchResults = await this.qdrantClient.search(
        this.collectionName,
        {
          vector: queryVector,
          limit: k * 3,
          filter,
          params: {
            hnsw_ef: 128,
            exact: false,
          },
        },
      );

      // 语义召回会返回多个 chunk；这里先按 documentId 保留最高分 chunk，避免同一文档挤占全部 topK。
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

  async keywordSearch(
    query: string,
    k: number = 8,
    filters?: { documentIds?: string[] },
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      await this.ensureCollectionExists();

      // MVP 阶段先用轻量 token match 补齐精确词召回，后续可替换为 BM25/全文索引。
      const tokens = tokenizeQuery(query);
      if (tokens.length === 0) {
        return [];
      }

      const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
        limit: Math.max(k * 16, 128),
        with_payload: true,
        with_vector: false,
        filter: buildDocumentFilter(filters?.documentIds),
      });

      return scrollResult.points
        .map((point) => createScoredDocument(point, (metadata, content) =>
          scoreKeywordMatch(tokens, query, metadata, content),
        ))
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行关键词检索时出错:`, error);
      throw error;
    }
  }

  async metadataSearch(
    query: string,
    k: number = 4,
    filters?: { documentIds?: string[]; updatedAfter?: number },
  ): Promise<Array<{ document: Document; score: number }>> {
    try {
      await this.ensureCollectionExists();

      // metadata 召回专注标题、documentId、tags、更新时间等结构化信号，不参与向量计算。
      const tokens = tokenizeQuery(query);
      if (tokens.length === 0) {
        return [];
      }

      const scrollResult = await this.qdrantClient.scroll(this.collectionName, {
        limit: Math.max(k * 12, 96),
        with_payload: true,
        with_vector: false,
        filter: buildDocumentFilter(filters?.documentIds),
      });

      return scrollResult.points
        .map((point) => createScoredDocument(point, (metadata) =>
          scoreMetadataMatch(tokens, metadata, filters?.updatedAfter),
        ))
        .filter((result) => result.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
    } catch (error) {
      console.error(`[QdrantVectorStore] 执行 metadata 检索时出错:`, error);
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
    indexMetadata?: DocumentIndexMetadata,
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
    const headingMetadata = extractHeadingMetadata(content);
    const tags = mergeTags(indexMetadata?.tags, extractInlineTags(`${title}\n${plainTextContent}`));
    const updatedAt = indexMetadata?.updatedAt ?? Date.now();

    const chunks = splits.map((split, index) => ({
      chunkIndex: index,
      pageContent: split,
      metadata: {
        documentId,
        title,
        updatedAt,
        tags,
        documentPath: indexMetadata?.documentPath ?? [],
        headingPath: headingMetadata.headingPath,
        headings: headingMetadata.headings,
        neighborSummary: buildNeighborSummary(splits, index),
      },
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

  async upsertAgentMemory(userId: string, memory: AgentMemoryIndexItem): Promise<void> {
    const documentId = memoryDocumentId(memory.id);
    const contentHash = hashText([
      memory.type,
      memory.kind,
      memory.category,
      memory.scopeLevel,
      memory.scopeKey,
      memory.content,
      memory.summary,
      memory.reason,
      memory.updatedAt,
    ].filter(Boolean).join(":"));
    const pageContent = [
      `类型: ${memory.type}`,
      memory.kind ? `分层: ${memory.kind}` : "",
      memory.category ? `类别: ${memory.category}` : "",
      memory.scopeLevel && memory.scopeKey ? `作用域: ${memory.scopeLevel}:${memory.scopeKey}` : "",
      memory.summary ? `摘要: ${memory.summary}` : "",
      `内容: ${memory.content}`,
      memory.reason ? `原因: ${memory.reason}` : "",
    ].filter(Boolean).join("\n");

    await this.deleteDocumentChunks(documentId);
    const [embedding] = await this.embeddings.embedDocuments([pageContent]);
    await this.addDocumentChunks(userId, documentId, [{
      chunkIndex: 0,
      pageContent,
      metadata: {
        kind: "agentMemory",
        memoryId: memory.id,
        memoryType: memory.type,
        memoryKind: memory.kind,
        memoryCategory: memory.category,
        memoryScopeLevel: memory.scopeLevel,
        memoryScopeKey: memory.scopeKey,
        title: `Memory: ${memory.kind ?? memory.type}`,
        updatedAt: memory.updatedAt ?? Date.now(),
        tags: ["agent-memory", memory.type, memory.kind, memory.category].filter(Boolean) as string[],
        confidence: memory.confidence ?? 1,
        importance: memory.importance,
        source: memory.source,
      },
      embedding,
    }], contentHash);
  }

  async semanticSearchAgentMemories(
    query: string,
    activeMemoryIds: string[],
    k: number = 8,
    minScore: number = 0.35,
  ): Promise<Array<{ memoryId: string; score: number }>> {
    if (activeMemoryIds.length === 0) {
      return [];
    }

    const results = await this.semanticSearch(
      query,
      Math.min(Math.max(k, 1), activeMemoryIds.length),
      minScore,
      { includeDocumentIds: activeMemoryIds.map(memoryDocumentId) },
    );

    return results
      .map((result) => ({
        memoryId: stringValue(result.document.metadata.memoryId),
        score: result.score,
      }))
      .filter((result) => result.memoryId);
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

function tokenizeQuery(query: string): string[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const tokens = normalizedQuery
    .split(/[\s,，.。:：;；/\\()[\]{}'"`|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

  return Array.from(new Set([normalizedQuery, ...tokens]));
}

function payloadIndexDefinitions(): Array<{ field: string; schema: "keyword" | "integer" }> {
  return [
    { field: "metadata.kind", schema: "keyword" },
    { field: "metadata.documentId", schema: "keyword" },
    { field: "metadata.title", schema: "keyword" },
    { field: "metadata.contentHash", schema: "keyword" },
    { field: "metadata.updatedAt", schema: "integer" },
    { field: "metadata.tags", schema: "keyword" },
    { field: "metadata.headingPath", schema: "keyword" },
    { field: "metadata.documentPath", schema: "keyword" },
  ];
}

function memoryDocumentId(memoryId: string): string {
  return `memory:${memoryId}`;
}

function hashText(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16);
}

function extractHeadingMetadata(content: string): { headings: string[]; headingPath: string } {
  try {
    const blocks = JSON.parse(content);
    const headings: string[] = [];
    collectHeadings(blocks, headings);
    const uniqueHeadings = Array.from(new Set(headings)).slice(0, 8);
    return {
      headings: uniqueHeadings,
      headingPath: uniqueHeadings.join(" > "),
    };
  } catch {
    return { headings: [], headingPath: "" };
  }
}

function collectHeadings(node: unknown, headings: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectHeadings(child, headings);
    return;
  }

  if (!node || typeof node !== "object") {
    return;
  }

  const block = node as { type?: string; content?: unknown; children?: unknown };
  if (block.type === "heading") {
    const heading = extractInlineText(block.content).trim();
    if (heading) headings.push(heading);
  }

  collectHeadings(block.children, headings);
}

function extractInlineText(node: unknown): string {
  if (Array.isArray(node)) {
    return node.map(extractInlineText).join("");
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  const block = node as { text?: unknown; content?: unknown; children?: unknown };
  const text = typeof block.text === "string" ? block.text : "";
  return `${text}${extractInlineText(block.content)}${extractInlineText(block.children)}`;
}

function extractInlineTags(text: string): string[] {
  return Array.from(text.matchAll(/#([\p{L}\p{N}_-]+)/gu), (match) => match[1]);
}

function mergeTags(explicitTags: string[] | undefined, inlineTags: string[]): string[] {
  return Array.from(
    new Set(
      [...(explicitTags ?? []), ...inlineTags]
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).slice(0, 20);
}

function buildNeighborSummary(chunks: string[], index: number): string {
  const previous = chunks[index - 1] ? `前文: ${chunks[index - 1].slice(0, 80)}` : "";
  const next = chunks[index + 1] ? `后文: ${chunks[index + 1].slice(0, 80)}` : "";
  return [previous, next].filter(Boolean).join("\n");
}

function normalizeSemanticFilters(
  filters?: SemanticSearchFilters | Set<string>,
): SemanticSearchFilters | undefined {
  if (!filters) {
    return undefined;
  }

  if (filters instanceof Set) {
    return { excludeDocumentIds: Array.from(filters) };
  }

  return filters;
}

function buildSemanticFilter(filters?: SemanticSearchFilters): any | undefined {
  if (!filters) {
    return undefined;
  }

  const filter: any = {};
  if (filters.includeDocumentIds && filters.includeDocumentIds.length > 0) {
    filter.should = filters.includeDocumentIds.map((documentId) => ({
      key: "metadata.documentId",
      match: { value: documentId },
    }));
  }

  if (filters.excludeDocumentIds && filters.excludeDocumentIds.length > 0) {
    filter.must_not = filters.excludeDocumentIds.map((documentId) => ({
      key: "metadata.documentId",
      match: { value: documentId },
    }));
  }

  return filter.should || filter.must_not ? filter : undefined;
}

function buildDocumentFilter(documentIds?: string[]): any | undefined {
  if (!documentIds || documentIds.length === 0) {
    return undefined;
  }

  return {
    should: documentIds.map((documentId) => ({
      key: "metadata.documentId",
      match: { value: documentId },
    })),
  };
}

function createScoredDocument(
  point: { payload?: Record<string, unknown> | null },
  score: (metadata: Record<string, unknown>, content: string) => number,
): { document: Document; score: number } {
  const payload = point.payload ?? {};
  const content = typeof payload.pageContent === "string" ? payload.pageContent : "";
  const metadata = normalizeMetadata(payload.metadata);

  return {
    document: new Document({
      pageContent: content,
      metadata,
    }),
    score: score(metadata, content),
  };
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }

  return {};
}

function scoreKeywordMatch(
  tokens: string[],
  query: string,
  metadata: Record<string, unknown>,
  content: string,
): number {
  const title = stringValue(metadata.title).toLowerCase();
  const normalizedContent = content.toLowerCase();
  const normalizedQuery = query.trim().toLowerCase();
  let score = 0;

  if (title.includes(normalizedQuery)) score += 3;
  if (normalizedContent.includes(normalizedQuery)) score += 2;

  for (const token of tokens) {
    if (title.includes(token)) score += 1.5;
    if (normalizedContent.includes(token)) score += 1;
  }

  return score / Math.max(tokens.length, 1);
}

function scoreMetadataMatch(
  tokens: string[],
  metadata: Record<string, unknown>,
  updatedAfter?: number,
): number {
  const title = stringValue(metadata.title).toLowerCase();
  const documentId = stringValue(metadata.documentId).toLowerCase();
  const tags = arrayText(metadata.tags).toLowerCase();
  const headings = arrayText(metadata.headings).toLowerCase();
  const headingPath = stringValue(metadata.headingPath).toLowerCase();
  const documentPath = arrayText(metadata.documentPath).toLowerCase();
  const neighborSummary = stringValue(metadata.neighborSummary).toLowerCase();
  const updatedAt = typeof metadata.updatedAt === "number" ? metadata.updatedAt : undefined;
  let score = 0;

  for (const token of tokens) {
    if (title.includes(token)) score += 2;
    if (documentId.includes(token)) score += 1.5;
    if (tags.includes(token)) score += 1.2;
    if (headingPath.includes(token)) score += 1.6;
    if (headings.includes(token)) score += 1.4;
    if (documentPath.includes(token)) score += 1.1;
    if (neighborSummary.includes(token)) score += 0.4;
  }

  if (updatedAfter && updatedAt && updatedAt >= updatedAfter) {
    score += 1;
  } else if (updatedAt) {
    score += recencyBoost(updatedAt);
  }

  return score / Math.max(tokens.length, 1);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function arrayText(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join(" ") : "";
}

function recencyBoost(updatedAt: number): number {
  const ageInDays = Math.max(0, (Date.now() - updatedAt) / 86_400_000);
  if (ageInDays <= 7) return 0.6;
  if (ageInDays <= 30) return 0.3;
  return 0;
}
