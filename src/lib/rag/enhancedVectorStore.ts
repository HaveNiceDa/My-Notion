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
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    // 过滤掉需要排除的文档
    const filteredDocuments = excludeDocumentIds
      ? this.documents.filter(
          (doc) => !excludeDocumentIds.has(doc.metadata?.documentId || ""),
        )
      : this.documents;

    console.log(
      `[EnhancedVectorStore] 使用内存中的 ${filteredDocuments.length} 个chunk进行相似度检索`,
    );
    console.log(`[EnhancedVectorStore] 查询: ${query}`);

    const queryEmbedding = await this.embeddings.embedQuery(query);
    console.log(
      `[EnhancedVectorStore] 查询嵌入向量维度: ${queryEmbedding.length}`,
    );

    const similarities = filteredDocuments.map((doc) => {
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
    excludeDocumentIds?: Set<string>,
  ): Promise<Array<{ document: Document; score: number }>> {
    console.log(`[EnhancedVectorStore] 执行关键词检索: ${query}`);

    // 分词处理
    const queryTokens = this.tokenize(query);
    const queryTerms: Set<string> = new Set(queryTokens);

    console.log(
      `[EnhancedVectorStore] 查询分词结果: ${Array.from(queryTerms).join(", ")}`,
    );

    // 过滤掉需要排除的文档
    const filteredDocuments = excludeDocumentIds
      ? this.documents.filter(
          (doc) => !excludeDocumentIds.has(doc.metadata?.documentId || ""),
        )
      : this.documents;

    // 计算每个文档的关键词相似度
    const similarities = filteredDocuments.map((doc) => {
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

      // 计算查询词在文档中的总出现次数（包括重复）
      let totalMatches = 0;
      for (const term of queryTermsArray) {
        totalMatches += docTokens.filter((token) => token === term).length;
      }

      // 增强的相似度得分计算
      // 1. 基础Jaccard相似度
      const unionSize = queryTerms.size + docTerms.size - intersectionSize;
      const jaccardScore = unionSize > 0 ? intersectionSize / unionSize : 0;

      // 2. 重叠比例（查询词在文档中的比例）
      const overlapRatio =
        queryTerms.size > 0 ? intersectionSize / queryTerms.size : 0;

      // 3. 文档覆盖率（文档中包含的查询词比例）
      const coverageRatio =
        docTerms.size > 0 ? intersectionSize / docTerms.size : 0;

      // 4. 关键词密度（查询词在文档中的出现频率）
      const densityRatio =
        docTokens.length > 0 ? totalMatches / docTokens.length : 0;

      // 5. 查询长度与文档长度比例
      const lengthRatio = Math.min(
        1,
        docTerms.size / Math.max(queryTerms.size, 1),
      );

      // 6. 数字匹配增强
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
        numberMatchBonus = 0.1 + exactNumberMatches * 0.05;
      }

      // 7. 短文档奖励
      const shortDocumentBonus = docTerms.size <= 5 ? 0.1 : 0;

      // 综合得分 - 增强关键词匹配分数
      const baseScore = 0.2; // 进一步降低基础分数

      // 检查是否有实际的关键词匹配
      const hasSignificantMatch = jaccardScore > 0.1 || overlapRatio > 0.1;

      if (!hasSignificantMatch) {
        // 没有显著匹配，直接返回低分
        return {
          document: new Document({
            pageContent: doc.pageContent,
            metadata: doc.metadata,
          }),
          score: 0.0,
        };
      }

      const score = Math.min(
        0.98, // 分数上限
        baseScore +
          jaccardScore * 0.8 + // 提高核心相似度权重
          overlapRatio * 0.6 + // 调整overlapRatio权重
          coverageRatio * 0.2 +
          densityRatio * 0.1 +
          lengthRatio * 0.1 +
          numberMatchBonus +
          shortDocumentBonus,
      );

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
  private async calculateTitleSimilarity(
    query: string,
    title: string,
  ): Promise<number> {
    try {
      // 1. 语义检索
      const queryEmbedding = await this.embeddings.embedQuery(query);
      const titleEmbedding = await this.embeddings.embedQuery(title);
      const semanticSimilarity = this.cosineSimilarity(
        queryEmbedding,
        titleEmbedding,
      );

      // 2. 关键词检索
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

      // 计算标题覆盖率：标题词在查询中的比例
      const titleCoverage =
        titleTokens.length > 0 ? intersectionSize / titleTokens.length : 0;

      // 计算查询覆盖率：查询词在标题中的比例
      const queryCoverage =
        queryTokens.length > 0 ? intersectionSize / queryTokens.length : 0;

      // 关键词综合得分（基础分数改为0.2）
      const keywordScore = Math.max(
        titleCoverage * 0.7 + queryCoverage * 0.3,
        0.2,
      );

      // 3. 结果融合
      const semanticWeight = 0.7;
      const keywordWeight = 0.3;
      let finalScore =
        semanticSimilarity * semanticWeight + keywordScore * keywordWeight;

      console.log(
        `[EnhancedVectorStore] 标题相似度计算: 标题=${title}, 查询=${query}, 语义相似度=${semanticSimilarity.toFixed(4)}, 关键词得分=${keywordScore.toFixed(4)}, 最终得分=${finalScore.toFixed(4)}`,
      );

      return finalScore;
    } catch (error) {
      console.error(`[EnhancedVectorStore] 标题相似度计算错误:`, error);
      // 回退到词元匹配方法
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

      // 计算标题覆盖率：标题词在查询中的比例
      const titleCoverage =
        titleTokens.length > 0 ? intersectionSize / titleTokens.length : 0;

      // 计算查询覆盖率：查询词在标题中的比例
      const queryCoverage =
        queryTokens.length > 0 ? intersectionSize / queryTokens.length : 0;

      // 综合得分：标题覆盖率更重要
      const combinedScore = titleCoverage * 0.7 + queryCoverage * 0.3;

      console.log(
        `[EnhancedVectorStore] 标题相似度计算(回退): 标题=${title}, 查询=${query}, 综合得分=${combinedScore.toFixed(4)}`,
      );

      return combinedScore;
    }
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
    const titleSimilarityThreshold = 0.6;
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
    for (const [documentId, info] of Array.from(documentTitles.entries())) {
      const similarity = await this.calculateTitleSimilarity(query, info.title);
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
    }

    // 2. 获取标题相似度高的文档（完整内容）
    let titleSimilarResults: Array<{ document: Document; score: number }> = [];
    const titleHitDocumentIds = new Set<string>();

    if (titleSimilarDocuments.length > 0) {
      console.log(
        `[EnhancedVectorStore] 检测到标题相似度高的文档，使用完整文档内容`,
      );

      for (const docInfo of titleSimilarDocuments) {
        const fullDocument = this.mergeChunksToFullDocument(
          docInfo.documentId,
          docInfo.title,
        );
        titleSimilarResults.push({
          document: fullDocument,
          score: docInfo.similarity,
        });
        titleHitDocumentIds.add(docInfo.documentId);
      }

      console.log(`[EnhancedVectorStore] 标题相关检索结果:`);
      titleSimilarResults.forEach((result, index) => {
        console.log(
          `[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`,
        );
      });
    }

    // 3. 对没有命中标题的文档执行常规chunk检索
    console.log(`[EnhancedVectorStore] 对未命中标题的文档执行常规chunk检索`);

    // 并行执行两种检索
    const [semanticResults, keywordResults] = await Promise.all([
      this.similaritySearch(query, k * 4, minScore * 0.8, titleHitDocumentIds),
      this.keywordSearch(query, k * 4, minScore * 0.8, titleHitDocumentIds),
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

    // 过滤掉已经在标题命中中的文档
    const filteredChunkResults = fusedResults.filter((result) => {
      const documentId = result.document.metadata?.documentId;
      return documentId ? !titleHitDocumentIds.has(documentId) : true;
    });

    // 合并标题结果和chunk检索结果
    const allResults = [...titleSimilarResults, ...filteredChunkResults];

    // 排序
    const sortedResults = allResults.sort((a, b) => b.score - a.score);

    console.log(`[EnhancedVectorStore] 综合检索结果（前${k}个）:`);
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

      // 对于低相似度的结果，仍然计算得分但不强制保底
      let score =
        semanticScore * semanticWeight + keywordScore * (1 - semanticWeight);

      score = Math.min(score, 0.98);

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
