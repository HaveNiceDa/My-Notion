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
    minScore: number = 0.6,
  ): Promise<Array<{ document: Document; score: number }>> {
    // 直接使用内存中的chunk，不再从数据库加载
    console.log(
      `[EnhancedVectorStore] 使用内存中的 ${this.documents.length} 个chunk进行相似度检索`,
    );
    console.log(`[EnhancedVectorStore] 查询: ${query}`);

    const queryEmbedding = await this.embeddings.embedQuery(query);
    console.log(
      `[EnhancedVectorStore] 查询嵌入向量维度: ${queryEmbedding.length}`,
    );

    const similarities = this.documents.map((doc) => {
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      console.log(
        `[EnhancedVectorStore] 文档得分: ${score.toFixed(4)}, 内容: ${doc.pageContent.substring(0, 50)}...`,
      );
      return {
        document: new Document({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
        }),
        score,
      };
    });

    const sortedResults = similarities.sort((a, b) => b.score - a.score);

    console.log(`[EnhancedVectorStore] 相似度检索结果（前${k}个）:`);
    sortedResults.slice(0, k).forEach((result, index) => {
      console.log(
        `[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`,
      );
    });

    return sortedResults.filter((s) => s.score >= minScore).slice(0, k);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }

  // 关键词检索方法
  async keywordSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
  ): Promise<Array<{ document: Document; score: number }>> {
    console.log(`[EnhancedVectorStore] 执行关键词检索: ${query}`);

    // 分词处理
    const queryTokens = this.tokenize(query);
    const queryTerms: Set<string> = new Set(queryTokens);

    console.log(
      `[EnhancedVectorStore] 查询分词结果: ${Array.from(queryTerms).join(", ")}`,
    );

    // 计算每个文档的关键词相似度
    const similarities = this.documents.map((doc) => {
      const docTokens = this.tokenize(doc.pageContent);
      const docTerms = new Set(docTokens);

      console.log(
        `[EnhancedVectorStore] 文档分词结果: ${Array.from(docTerms).join(", ")}`,
      );

      // 计算交集大小
      let intersectionSize = 0;
      const queryTermsArray = Array.from(queryTerms);
      for (let i = 0; i < queryTermsArray.length; i++) {
        const term = queryTermsArray[i];
        if (docTerms.has(term)) {
          intersectionSize++;
        }
      }

      // 简化的相似度得分计算
      // 1. 基础Jaccard相似度
      const unionSize = queryTerms.size + docTerms.size - intersectionSize;
      const jaccardScore = unionSize > 0 ? intersectionSize / unionSize : 0;

      // 2. 重叠比例（查询词在文档中的比例）
      const overlapRatio =
        queryTerms.size > 0 ? intersectionSize / queryTerms.size : 0;

      // 3. 数字匹配增强（降低数字匹配的权重）
      const queryHasNumbers = queryTermsArray.some((term) =>
        /^\d+$/.test(term),
      );
      const docHasNumbers = Array.from(docTerms).some((term) =>
        /^\d+$/.test(term),
      );
      let numberMatchBonus = 0;
      if (queryHasNumbers && docHasNumbers) {
        // 检查是否有完全匹配的数字
        const queryNumbers = queryTermsArray.filter((term) =>
          /^\d+$/.test(term),
        );
        const docNumbers = Array.from(docTerms).filter((term) =>
          /^\d+$/.test(term),
        );
        const exactNumberMatches = queryNumbers.filter((num) =>
          docNumbers.includes(num),
        ).length;
        numberMatchBonus = 0.1 + exactNumberMatches * 0.05; // 降低数字匹配权重
      }

      // 综合得分 - 简化公式
      const score = jaccardScore * 0.4 + overlapRatio * 0.6 + numberMatchBonus;

      console.log(
        `[EnhancedVectorStore] 更新关键词结果: 得分=${score.toFixed(4)}, 内容=${doc.pageContent.substring(0, 50)}...`,
      );

      return {
        document: new Document({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
        }),
        score,
      };
    });

    const sortedResults = similarities.sort((a, b) => b.score - a.score);

    console.log(`[EnhancedVectorStore] 关键词检索结果（前${k}个）:`);
    sortedResults.slice(0, k).forEach((result, index) => {
      console.log(
        `[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`,
      );
    });

    return sortedResults.filter((s) => s.score >= minScore).slice(0, k);
  }

  // 分词辅助方法
  private tokenize(text: string): string[] {
    // 优化的分词实现，提高对中文和数字的处理能力
    const tokens: string[] = [];

    // 1. 首先处理空白字符分割
    const parts = text.split(/\s+/);

    for (const part of parts) {
      if (!part) continue;

      // 2. 分别处理中文、数字和其他字符
      // 提取中文部分
      const chineseMatches = part.match(/[\u4e00-\u9fa5]+/g);
      if (chineseMatches) {
        for (const chineseMatch of chineseMatches) {
          // 中文按字符分割
          for (const char of chineseMatch) {
            tokens.push(char);
          }
        }
      }

      // 提取数字部分
      const numberMatches = part.match(/\d+/g);
      if (numberMatches) {
        numberMatches.forEach((num) => tokens.push(num));
      }

      // 提取英文部分
      const englishMatches = part.match(/[a-zA-Z]+/g);
      if (englishMatches) {
        for (const englishMatch of englishMatches) {
          const cleaned = englishMatch.toLowerCase();
          if (cleaned.length > 1) {
            // 英文至少2个字符
            tokens.push(cleaned);
          }
        }
      }
    }

    // 3. 过滤空token
    return tokens.filter((token) => token.length > 0);
  }

  // 计算标题相似度
  private calculateTitleSimilarity(query: string, title: string): number {
    const queryTokens = this.tokenize(query);
    const titleTokens = this.tokenize(title);

    const querySet = new Set(queryTokens);
    const titleSet = new Set(titleTokens);

    // 计算交集大小
    let intersectionSize = 0;
    Array.from(querySet).forEach((token) => {
      if (titleSet.has(token)) {
        intersectionSize++;
      }
    });

    // 计算Jaccard相似度
    const unionSize = querySet.size + titleSet.size - intersectionSize;
    return unionSize > 0 ? intersectionSize / unionSize : 0;
  }

  // 获取文档的所有chunk并合并为完整内容
  private getDocumentChunksById(documentId: string): InMemoryDocument[] {
    return this.documents.filter(
      (doc) => doc.metadata?.documentId === documentId,
    );
  }

  // 合并文档的所有chunk为完整内容
  private mergeChunksToFullDocument(
    documentId: string,
    title: string,
  ): Document {
    const chunks = this.getDocumentChunksById(documentId);
    // 按chunkIndex排序
    const sortedChunks = chunks.sort((a, b) => {
      const indexA = a.metadata?.chunkIndex || 0;
      const indexB = b.metadata?.chunkIndex || 0;
      return indexA - indexB;
    });

    // 合并内容
    const fullContent = sortedChunks
      .map((chunk) => chunk.pageContent)
      .join("\n");

    return new Document({
      pageContent: fullContent,
      metadata: { documentId, title },
    });
  }

  // 混合检索方法
  async hybridSearch(
    query: string,
    k: number = 4,
    minScore: number = 0.6,
    semanticWeight: number = 0.5,
  ): Promise<Array<{ document: Document; score: number }>> {
    console.log(`[EnhancedVectorStore] 执行混合检索: ${query}`);
    console.log(
      `[EnhancedVectorStore] 语义权重: ${semanticWeight}, 关键词权重: ${1 - semanticWeight}`,
    );

    // 1. 标题相似度检测
    const titleSimilarityThreshold = 0.8;
    const documentTitles = new Map<
      string,
      { title: string; chunks: InMemoryDocument[] }
    >();

    // 收集所有文档标题
    for (const doc of this.documents) {
      const documentId = doc.metadata?.documentId;
      const title = doc.metadata?.title;
      if (documentId && title) {
        if (!documentTitles.has(documentId)) {
          documentTitles.set(documentId, { title, chunks: [] });
        }
        documentTitles.get(documentId)!.chunks.push(doc);
      }
    }

    // 计算标题相似度
    const titleSimilarDocuments: Array<{
      documentId: string;
      title: string;
      similarity: number;
    }> = [];
    Array.from(documentTitles.entries()).forEach(([documentId, info]) => {
      const similarity = this.calculateTitleSimilarity(query, info.title);
      if (similarity >= titleSimilarityThreshold) {
        titleSimilarDocuments.push({
          documentId,
          title: info.title,
          similarity,
        });
        console.log(
          `[EnhancedVectorStore] 标题相似度高: 文档=${info.title}, 相似度=${similarity.toFixed(4)}`,
        );
      }
    });

    // 2. 如果有标题相似度高的文档，直接使用完整文档内容
    if (titleSimilarDocuments.length > 0) {
      console.log(
        `[EnhancedVectorStore] 检测到标题相似度高的文档，使用完整文档内容`,
      );

      const titleSimilarResults: Array<{ document: Document; score: number }> =
        [];
      for (const docInfo of titleSimilarDocuments) {
        const fullDocument = this.mergeChunksToFullDocument(
          docInfo.documentId,
          docInfo.title,
        );
        titleSimilarResults.push({
          document: fullDocument,
          score: Math.max(docInfo.similarity, 0.6), // 保底分数0.6
        });
      }

      // 排序并返回前k个结果，应用minScore阈值
      const sortedResults = titleSimilarResults.sort(
        (a, b) => b.score - a.score,
      );

      console.log(`[EnhancedVectorStore] 标题相关检索结果（前${k}个）:`);
      sortedResults.slice(0, k).forEach((result, index) => {
        console.log(
          `[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`,
        );
      });

      return sortedResults.filter((s) => s.score >= minScore).slice(0, k);
    }

    // 3. 如果没有标题相似度高的文档，使用常规的chunk检索
    console.log(
      `[EnhancedVectorStore] 未检测到标题相似度高的文档，使用常规chunk检索`,
    );

    // 并行执行两种检索
    const [semanticResults, keywordResults] = await Promise.all([
      this.similaritySearch(query, k * 4, minScore * 0.8),
      this.keywordSearch(query, k * 4, minScore * 0.8),
    ]);

    console.log(
      `[EnhancedVectorStore] 语义检索结果数量: ${semanticResults.length}`,
    );
    console.log(
      `[EnhancedVectorStore] 关键词检索结果数量: ${keywordResults.length}`,
    );

    // 结果融合
    const fusedResults = this.fuseResults(
      semanticResults,
      keywordResults,
      semanticWeight,
    );

    const sortedResults = fusedResults.sort((a, b) => b.score - a.score);

    console.log(`[EnhancedVectorStore] 混合检索结果（前${k}个）:`);
    sortedResults.slice(0, k).forEach((result, index) => {
      console.log(
        `[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`,
      );
    });

    // 应用原始minScore阈值
    console.log(`[EnhancedVectorStore] 应用最小得分阈值: ${minScore}`);

    return sortedResults.filter((s) => s.score >= minScore).slice(0, k);
  }

  // 结果融合方法
  private fuseResults(
    semanticResults: Array<{ document: Document; score: number }>,
    keywordResults: Array<{ document: Document; score: number }>,
    semanticWeight: number,
  ): Array<{ document: Document; score: number }> {
    const documentMap = new Map<
      string,
      { document: Document; semanticScore: number; keywordScore: number }
    >();

    console.log(
      `[EnhancedVectorStore] 开始融合结果: 语义结果${semanticResults.length}个, 关键词结果${keywordResults.length}个`,
    );

    // 处理语义检索结果
    for (const result of semanticResults) {
      const metadata = result.document.metadata || {};
      // 使用更稳定的文档标识
      const docKey =
        (metadata.documentId || "") +
        "_" +
        result.document.pageContent.substring(0, 150).replace(/\s+/g, "");
      documentMap.set(docKey, {
        document: result.document,
        semanticScore: result.score,
        keywordScore: 0,
      });
      console.log(
        `[EnhancedVectorStore] 添加语义结果: 得分=${result.score}, 内容=${result.document.pageContent.substring(0, 50)}...`,
      );
    }

    // 处理关键词检索结果
    for (const result of keywordResults) {
      const metadata = result.document.metadata || {};
      // 使用更稳定的文档标识
      const docKey =
        (metadata.documentId || "") +
        "_" +
        result.document.pageContent.substring(0, 150).replace(/\s+/g, "");
      if (documentMap.has(docKey)) {
        const existing = documentMap.get(docKey)!;
        existing.keywordScore = result.score;
        console.log(
          `[EnhancedVectorStore] 更新关键词结果: 得分=${result.score}, 内容=${result.document.pageContent.substring(0, 50)}...`,
        );
      } else {
        documentMap.set(docKey, {
          document: result.document,
          semanticScore: 0,
          keywordScore: result.score,
        });
        console.log(
          `[EnhancedVectorStore] 添加关键词结果: 得分=${result.score}, 内容=${result.document.pageContent.substring(0, 50)}...`,
        );
      }
    }

    // 计算最终得分
    const fusedResults = Array.from(documentMap.values()).map((item) => {
      // 直接使用原始得分，不再归一化
      const semanticScore = item.semanticScore;
      const keywordScore = item.keywordScore;

      // 检查是否有高相似度的结果，直接召回
      if (semanticScore >= 0.6 || keywordScore >= 0.6) {
        // 权重相加
        let score =
          semanticScore * semanticWeight + keywordScore * (1 - semanticWeight);
        // 分数保底0.6
        score = Math.max(score, 0.6);

        console.log(
          `[EnhancedVectorStore] 融合结果: 语义得分=${semanticScore.toFixed(4)}, 关键词得分=${keywordScore.toFixed(4)}, 最终得分=${score.toFixed(4)}, 内容=${item.document.pageContent.substring(0, 50)}...`,
        );

        return {
          document: item.document,
          score,
        };
      }

      // 对于低相似度的结果，仍然计算得分但不强制保底
      let score =
        semanticScore * semanticWeight + keywordScore * (1 - semanticWeight);

      return {
        document: item.document,
        score,
      };
    });

    console.log(
      `[EnhancedVectorStore] 融合完成，共${fusedResults.length}个结果`,
    );

    return fusedResults;
  }
}
