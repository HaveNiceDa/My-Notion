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
    minScore: number = 0,
  ): Promise<Array<{ document: Document; score: number }>> {
    // 直接使用内存中的chunk，不再从数据库加载
    console.log(`[EnhancedVectorStore] 使用内存中的 ${this.documents.length} 个chunk进行相似度检索`);
    console.log(`[EnhancedVectorStore] 查询: ${query}`);

    const queryEmbedding = await this.embeddings.embedQuery(query);
    console.log(`[EnhancedVectorStore] 查询嵌入向量维度: ${queryEmbedding.length}`);

    const similarities = this.documents.map((doc) => {
      const score = this.cosineSimilarity(queryEmbedding, doc.embedding);
      console.log(`[EnhancedVectorStore] 文档得分: ${score.toFixed(4)}, 内容: ${doc.pageContent.substring(0, 50)}...`);
      return {
        document: new Document({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
        }),
        score,
      };
    });

    const sortedResults = similarities
      .sort((a, b) => b.score - a.score);
      
    console.log(`[EnhancedVectorStore] 相似度检索结果（前${k}个）:`);
    sortedResults.slice(0, k).forEach((result, index) => {
      console.log(`[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`);
    });

    return sortedResults
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

  // 关键词检索方法
  async keywordSearch(
    query: string,
    k: number = 4,
    minScore: number = 0,
  ): Promise<Array<{ document: Document; score: number }>> {
    console.log(`[EnhancedVectorStore] 执行关键词检索: ${query}`);

    // 分词处理
    const queryTokens = this.tokenize(query);
    const queryTerms: Set<string> = new Set(queryTokens);
    
    console.log(`[EnhancedVectorStore] 查询分词结果: ${Array.from(queryTerms).join(', ')}`);

    // 计算每个文档的关键词相似度
    const similarities = this.documents.map((doc) => {
      const docTokens = this.tokenize(doc.pageContent);
      const docTerms = new Set(docTokens);
      
      console.log(`[EnhancedVectorStore] 文档分词结果: ${Array.from(docTerms).join(', ')}`);

      // 计算交集大小
      let intersectionSize = 0;
      const queryTermsArray = Array.from(queryTerms);
      for (let i = 0; i < queryTermsArray.length; i++) {
        const term = queryTermsArray[i];
        if (docTerms.has(term)) {
          intersectionSize++;
        }
      }

      // 计算改进的相似度得分
      // 1. 基础Jaccard相似度
      const unionSize = queryTerms.size + docTerms.size - intersectionSize;
      const jaccardScore = unionSize > 0 ? intersectionSize / unionSize : 0;
      
      // 2. 重叠比例（查询词在文档中的比例）
      const overlapRatio = queryTerms.size > 0 ? intersectionSize / queryTerms.size : 0;
      
      // 3. 长度因子（对短文本友好，短文本权重更高）
      const lengthFactor = Math.min(1.2, 1 + 0.8 * (1 / Math.log(docTokens.length + 2)));
      
      // 4. 数字匹配增强（更强的数字匹配权重）
      const queryHasNumbers = queryTermsArray.some(term => /^\d+$/.test(term));
      const docHasNumbers = Array.from(docTerms).some(term => /^\d+$/.test(term));
      let numberMatchBonus = 0;
      if (queryHasNumbers && docHasNumbers) {
        // 检查是否有完全匹配的数字
        const queryNumbers = queryTermsArray.filter(term => /^\d+$/.test(term));
        const docNumbers = Array.from(docTerms).filter(term => /^\d+$/.test(term));
        const exactNumberMatches = queryNumbers.filter(num => docNumbers.includes(num)).length;
        numberMatchBonus = 0.3 + (exactNumberMatches * 0.2); // 基础数字匹配+精确数字匹配奖励
      }
      
      // 5. 短文本特殊处理
      const shortTextBonus = docTokens.length <= 10 ? 0.1 : 0;
      
      // 6. 重复内容处理（考虑文档中的重复词）
      let repetitionBonus = 0;
      if (docTokens.length > queryTokens.length) {
        // 计算查询词在文档中的出现频率
        let totalMatches = 0;
        for (const term of queryTermsArray) {
          totalMatches += docTokens.filter(token => token === term).length;
        }
        if (totalMatches > intersectionSize) {
          repetitionBonus = Math.min(0.1, (totalMatches - intersectionSize) * 0.05);
        }
      }
      
      // 综合得分
      const score = (jaccardScore * 0.4 + overlapRatio * 0.6) * lengthFactor + numberMatchBonus + shortTextBonus + repetitionBonus;
      
      console.log(`[EnhancedVectorStore] 文档得分: Jaccard=${jaccardScore}, Overlap=${overlapRatio}, Length=${lengthFactor}, NumberBonus=${numberMatchBonus}, ShortTextBonus=${shortTextBonus}, RepetitionBonus=${repetitionBonus}, Total=${score}`);

      return {
        document: new Document({
          pageContent: doc.pageContent,
          metadata: doc.metadata,
        }),
        score,
      };
    });

    const sortedResults = similarities
      .sort((a, b) => b.score - a.score);
      
    console.log(`[EnhancedVectorStore] 关键词检索结果（前${k}个）:`);
    sortedResults.slice(0, k).forEach((result, index) => {
      console.log(`[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`);
    });

    return sortedResults
      .filter((s) => s.score >= minScore)
      .slice(0, k);
  }

  // 分词辅助方法
  private tokenize(text: string): string[] {
    // 优化的分词实现，提高对中文和数字的处理能力
    const tokens: string[] = [];
    
    // 1. 首先处理空白字符分割
    const parts = text.split(/\s+/);
    
    for (const part of parts) {
      if (!part) continue;
      
      // 2. 检查是否全是中文或数字
      if (/^[\u4e00-\u9fa50-9]+$/.test(part)) {
        // 处理数字序列
        const numberMatch = part.match(/\d+/g);
        if (numberMatch) {
          // 保留完整的数字序列
          numberMatch.forEach(num => tokens.push(num));
        }
        
        // 处理中文部分
        const chinesePart = part.replace(/\d+/g, '');
        if (chinesePart) {
          // 中文按字符分割
          for (const char of chinesePart) {
            tokens.push(char);
          }
        }
      } else {
        // 包含其他字符，按空白字符分割后再处理
        // 过滤掉非字母数字字符
        const cleaned = part.toLowerCase().replace(/[^\w\d]/g, '');
        if (cleaned) {
          tokens.push(cleaned);
        }
      }
    }
    
    // 3. 保留重要的单字符
    // 对于中文，保留所有字符
    // 对于英文，过滤掉单字符
    return tokens.filter((token) => {
      // 中文单字符保留
      if (/^[\u4e00-\u9fa5]$/.test(token)) {
        return true;
      }
      // 数字保留（任意长度）
      if (/^\d+$/.test(token)) {
        return true;
      }
      // 英文至少2个字符
      return token.length > 1;
    });
  }

  // 混合检索方法
  async hybridSearch(
    query: string,
    k: number = 4,
    minScore: number = 0,
    semanticWeight: number = 0.4,
  ): Promise<Array<{ document: Document; score: number }>> {
    console.log(`[EnhancedVectorStore] 执行混合检索: ${query}`);
    console.log(`[EnhancedVectorStore] 语义权重: ${semanticWeight}, 关键词权重: ${1 - semanticWeight}`);

    // 并行执行两种检索
    const [semanticResults, keywordResults] = await Promise.all([
      this.similaritySearch(query, k * 4, minScore * 0.2),
      this.keywordSearch(query, k * 4, minScore * 0.2),
    ]);

    console.log(`[EnhancedVectorStore] 语义检索结果数量: ${semanticResults.length}`);
    console.log(`[EnhancedVectorStore] 关键词检索结果数量: ${keywordResults.length}`);

    // 结果融合
    const fusedResults = this.fuseResults(
      semanticResults,
      keywordResults,
      semanticWeight
    );

    const sortedResults = fusedResults
      .sort((a, b) => b.score - a.score);
      
    console.log(`[EnhancedVectorStore] 混合检索结果（前${k}个）:`);
    sortedResults.slice(0, k).forEach((result, index) => {
      console.log(`[EnhancedVectorStore]   ${index + 1}. 得分: ${result.score.toFixed(4)}, 内容: ${result.document.pageContent.substring(0, 50)}...`);
    });

    // 降低阈值，提高召回率
    const adjustedMinScore = Math.max(0, minScore * 0.6);
    console.log(`[EnhancedVectorStore] 调整后的最小得分阈值: ${adjustedMinScore}`);

    return sortedResults
      .filter((s) => s.score >= adjustedMinScore)
      .slice(0, k);
  }

  // 结果融合方法
  private fuseResults(
    semanticResults: Array<{ document: Document; score: number }>,
    keywordResults: Array<{ document: Document; score: number }>,
    semanticWeight: number,
  ): Array<{ document: Document; score: number }> {
    const keywordWeight = 1 - semanticWeight;
    const documentMap = new Map<string, { document: Document; semanticScore: number; keywordScore: number }>();

    console.log(`[EnhancedVectorStore] 开始融合结果: 语义结果${semanticResults.length}个, 关键词结果${keywordResults.length}个`);

    // 计算最大得分用于归一化
    const maxSemanticScore = Math.max(...semanticResults.map(r => r.score), 1);
    const maxKeywordScore = Math.max(...keywordResults.map(r => r.score), 1);

    // 处理语义检索结果
    for (const result of semanticResults) {
      const metadata = result.document.metadata || {};
      // 使用更稳定的文档标识
      const docKey = (metadata.documentId || '') + '_' + result.document.pageContent.substring(0, 150).replace(/\s+/g, '');
      documentMap.set(docKey, {
        document: result.document,
        semanticScore: result.score,
        keywordScore: 0,
      });
      console.log(`[EnhancedVectorStore] 添加语义结果: 得分=${result.score}, 内容=${result.document.pageContent.substring(0, 50)}...`);
    }

    // 处理关键词检索结果
    for (const result of keywordResults) {
      const metadata = result.document.metadata || {};
      // 使用更稳定的文档标识
      const docKey = (metadata.documentId || '') + '_' + result.document.pageContent.substring(0, 150).replace(/\s+/g, '');
      if (documentMap.has(docKey)) {
        const existing = documentMap.get(docKey)!;
        existing.keywordScore = result.score;
        console.log(`[EnhancedVectorStore] 更新关键词结果: 得分=${result.score}, 内容=${result.document.pageContent.substring(0, 50)}...`);
      } else {
        documentMap.set(docKey, {
          document: result.document,
          semanticScore: 0,
          keywordScore: result.score,
        });
        console.log(`[EnhancedVectorStore] 添加关键词结果: 得分=${result.score}, 内容=${result.document.pageContent.substring(0, 50)}...`);
      }
    }

    // 计算最终得分
    const fusedResults = Array.from(documentMap.values()).map((item) => {
      // 归一化得分
      const normalizedSemanticScore = item.semanticScore / maxSemanticScore;
      const normalizedKeywordScore = item.keywordScore / maxKeywordScore;
      
      // 计算基础加权得分
      let baseScore = normalizedSemanticScore * semanticWeight + normalizedKeywordScore * keywordWeight;
      
      // 高得分兜底机制：如果任意一方得分超过0.7，确保最终得分至少是0.7
      let score;
      if (normalizedSemanticScore > 0.7 || normalizedKeywordScore > 0.7) {
        // 如果任意一方得分超过0.7，确保最终得分至少是0.7
        score = Math.max(baseScore, 0.7);
        console.log(`[EnhancedVectorStore] 高得分兜底: 语义得分=${normalizedSemanticScore.toFixed(4)}, 关键词得分=${normalizedKeywordScore.toFixed(4)}, 基础得分=${baseScore.toFixed(4)}, 最终得分=${score.toFixed(4)}, 内容=${item.document.pageContent.substring(0, 50)}...`);
      } else {
        // 正常情况使用基础得分
        score = baseScore;
      }
      
      // 增强机制：如果两种检索都找到了该文档，给予额外奖励
      if (item.semanticScore > 0 && item.keywordScore > 0) {
        score += 0.1; // 同时被两种检索找到的文档获得额外奖励
      }
      
      // 增强机制：对于包含数字的查询和文档，提高关键词得分的权重
      const hasNumbers = /\d+/.test(item.document.pageContent);
      if (hasNumbers) {
        // 重新计算数字文档的加权得分
        const numberAdjustedScore = normalizedSemanticScore * (semanticWeight * 0.8) + normalizedKeywordScore * (keywordWeight * 1.2);
        // 如果是高得分文档，确保调整后的得分也至少是0.7
        if (normalizedSemanticScore > 0.7 || normalizedKeywordScore > 0.7) {
          score = Math.max(numberAdjustedScore, 0.7) + (item.semanticScore > 0 && item.keywordScore > 0 ? 0.1 : 0);
        } else {
          score = numberAdjustedScore + (item.semanticScore > 0 && item.keywordScore > 0 ? 0.1 : 0);
        }
      }
      
      console.log(`[EnhancedVectorStore] 融合结果: 语义得分=${normalizedSemanticScore.toFixed(4)}, 关键词得分=${normalizedKeywordScore.toFixed(4)}, 最终得分=${score.toFixed(4)}, 内容=${item.document.pageContent.substring(0, 50)}...`);
      
      return {
        document: item.document,
        score,
      };
    });
    
    console.log(`[EnhancedVectorStore] 融合完成，共${fusedResults.length}个结果`);
    
    return fusedResults;
  }
}
