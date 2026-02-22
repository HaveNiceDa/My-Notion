import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { CustomEmbeddings } from "./customEmbeddings";
import { EnhancedVectorStore } from "./enhancedVectorStore";
import { ChunkManager } from "./chunkManager";
import { promptLoader } from "../prompt/promptLoader";
import { useThinkingProcessStore } from "../store/use-thinking-process-store";

// 初始化Convex客户端（用于添加思考过程步骤）
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type AIModel = "qwen-plus" | "qwen-max" | "qwen3-coder-plus";

console.log("[RAG System] 加载RAG模块...");

// 文档分割器 - 优化配置以获得更好的检索效果
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 250,
  chunkOverlap: 40,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

console.log(`[RAG System] 文本分割器配置: chunkSize=250, chunkOverlap=40`);

// 初始化ChunkManager单例
const chunkManager = ChunkManager.getInstance();

// EnhancedVectorStore缓存 - 用于常驻实例
const vectorStoreCache = new Map<string, EnhancedVectorStore>(); // userId -> EnhancedVectorStore

// 提取文档文本内容 - 导出供其他模块使用
export const extractTextFromDocument = (content: string): string => {
  try {
    const parsedContent = JSON.parse(content);

    const extractText = (node: any): string => {
      let text = "";

      // 如果是数组，遍历每个元素
      if (Array.isArray(node)) {
        for (const item of node) {
          text += extractText(item);
        }
        return text;
      }

      // 如果是对象
      if (typeof node === "object" && node !== null) {
        // 检查content字段
        if (node.content && Array.isArray(node.content)) {
          for (const child of node.content) {
            if (child.type === "text" && child.text) {
              text += child.text;
            } else {
              text += extractText(child);
            }
          }
        }

        // 递归处理children字段
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            text += extractText(child);
          }
        }
      }

      return text;
    };

    const result = extractText(parsedContent);
    return result;
  } catch (error) {
    console.error("Error extracting text from document:", error);
    console.error("Error details:", error);
    return "";
  }
};

// 初始化知识库向量存储
export const initKnowledgeBaseVectorStore = async (
  userId: string,
  skipDocumentCheck: boolean = false,
): Promise<EnhancedVectorStore> => {
  console.log(
    `[RAG System] ===== 初始化知识库向量存储 - 用户: ${userId} =====`,
  );

  // 检查缓存
  if (vectorStoreCache.has(userId)) {
    console.log(`[RAG System] 使用缓存的EnhancedVectorStore实例`);
    const cachedStore = vectorStoreCache.get(userId)!;

    // 刷新内存中的chunk
    console.log(`[RAG System] 刷新内存中的chunk...`);
    const chunks = await chunkManager.loadChunksForUser(userId);
    cachedStore.documents = chunks;

    console.log(`[RAG System] ===== 向量存储初始化完成（使用缓存实例）=====`);
    return cachedStore;
  }

  try {
    console.log(`[RAG System] 获取用户知识库文档...`);
    // 获取用户知识库文档
    const documents = await convex.query(
      api.aiChat.getKnowledgeBaseDocumentsForRAG,
      {
        userId,
      },
    );
    console.log(`[RAG System] 找到 ${documents.length} 个知识库文档`);

    // 提取知识库文档ID列表
    const knowledgeBaseDocumentIds = documents.map((doc) => doc._id);
    console.log(
      `[RAG System] 知识库文档ID列表: ${knowledgeBaseDocumentIds.join(", ")}`,
    );

    console.log(`[RAG System] 创建EnhancedVectorStore实例...`);
    const vectorStore = new EnhancedVectorStore(
      convex,
      userId,
      new CustomEmbeddings(),
    );

    console.log(`[RAG System] 加载内存中的chunk...`);
    // 从ChunkManager加载chunk
    const chunks = await chunkManager.loadChunksForUser(userId);
    vectorStore.documents = chunks;
    console.log(
      `[RAG System] 加载完成，共 ${vectorStore.documents.length} 个向量`,
    );

    // 过滤向量数据，只保留知识库文档的向量
    console.log(`[RAG System] 开始过滤向量数据...`);
    vectorStore.documents = vectorStore.documents.filter((doc) => {
      const documentId = doc.metadata?.documentId;
      return knowledgeBaseDocumentIds.includes(documentId);
    });
    console.log(
      `[RAG System] 过滤完成，保留 ${vectorStore.documents.length} 个知识库向量`,
    );

    if (!skipDocumentCheck) {
      console.log(`[RAG System] 检查文档是否需要更新...`);
      for (const doc of documents) {
        if (doc.content) {
          console.log(`[RAG System] 检查文档: ${doc.title} (${doc._id})`);
          const text = extractTextFromDocument(doc.content);
          if (text) {
            console.log(`[RAG System] 检查是否需要重新嵌入...`);
            const needsReembed = await vectorStore.needsReembedding(
              doc._id,
              text,
            );

            if (needsReembed) {
              console.log(`[RAG System] 文档需要重新嵌入，开始处理...`);

              console.log(`[RAG System] 分割文档为chunks...`);
              const splits = await textSplitter.splitText(text);
              console.log(`[RAG System] 文档分割为 ${splits.length} 个chunks`);

              console.log(`[RAG System] 生成embeddings...`);
              const embeddings = await new CustomEmbeddings().embedDocuments(
                splits,
              );

              const chunks = splits.map((split, index) => ({
                chunkIndex: index,
                pageContent: split,
                metadata: { documentId: doc._id, title: doc.title },
                embedding: embeddings[index],
              }));

              console.log(`[RAG System] 保存chunks到Convex...`);
              await vectorStore.addDocumentChunks(userId, doc._id, chunks);

              // 刷新内存中的chunk
              await chunkManager.refreshChunksForUser(userId);

              console.log(`[RAG System] 文档嵌入完成: ${doc.title}`);
            } else {
              console.log(`[RAG System] 文档无需重新嵌入: ${doc.title}`);
            }
          }
        }
      }
    }

    // 缓存向量存储实例
    vectorStoreCache.set(userId, vectorStore);
    console.log(`[RAG System] ===== 向量存储初始化完成（新创建实例）=====`);

    return vectorStore;
  } catch (error) {
    console.error("[RAG System] 初始化向量存储时出错:", error);
    throw error;
  }
};

// 检索策略类型
export type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

// 构建上下文增强的查询
const buildEnhancedQuery = (
  query: string,
  conversationHistory: Array<{ role: string; content: string }> = [],
): string => {
  if (conversationHistory.length === 0) {
    return query;
  }

  // 提取最近的对话历史（最多3轮）
  const recentHistory = conversationHistory.slice(-3);

  // 构建历史摘要
  const historySummary = recentHistory
    .map(
      (msg) =>
        `${msg.role === "user" ? "用户" : "助手"}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? "..." : ""}`,
    )
    .join("\n");

  // 构建增强查询
  return `基于之前的对话:\n${historySummary}\n\n当前问题: ${query}`;
};

// 执行RAG查询
export const runRAGQuery = async (
  userId: string,
  query: string,
  model: AIModel = "qwen-max",
  minScore: number = 0.6,
  retrievalStrategy: RetrievalStrategy = "hybrid",
  semanticWeight: number = 0.5,
  conversationHistory: Array<{ role: string; content: string }> = [],
  knowledgeBaseEnabled: boolean = true,
  conversationId?: Id<"aiConversations">,
): Promise<string> => {
  console.log(`[RAG System] ===== 执行RAG查询 =====`);
  console.log(`[RAG System] 用户: ${userId}`);
  console.log(`[RAG System] 查询: ${query}`);
  console.log(`[RAG System] 模型: ${model}`);
  console.log(`[RAG System] 最小相似度: ${minScore}`);
  console.log(`[RAG System] 检索策略: ${retrievalStrategy}`);
  console.log(`[RAG System] 语义权重: ${semanticWeight}`);

  try {
    let searchResults: Array<{ document: Document; score: number }> = [];

    // 先删除旧的思考过程步骤
    if (conversationId) {
      const deletedCount = await convex.mutation(
        api.aiChat.deleteThinkingSteps,
        {
          conversationId,
        },
      );
      console.log(`[RAG System] 删除了 ${deletedCount} 个旧的思考过程步骤`);

      // 清除本地状态中的步骤
      try {
        const { clearSteps } = useThinkingProcessStore.getState();
        clearSteps();
        console.log(`[RAG System] 清除了本地状态中的思考过程步骤`);
      } catch (error) {
        console.error(`[RAG System] 清除本地状态时出错:`, error);
      }

      // 添加思考过程：检查知识库状态
      const { addStepToDatabase } = useThinkingProcessStore.getState();
      await addStepToDatabase(
        conversationId,
        "knowledge-base",
        "检查知识库状态",
        knowledgeBaseEnabled
          ? "知识库已启用，准备执行RAG检索"
          : "知识库已禁用，直接使用LLM原生能力",
      );

      // 添加思考过程：开始RAG查询
      await addStepToDatabase(
        conversationId,
        "start",
        "开始执行RAG查询",
        knowledgeBaseEnabled
          ? `查询: ${query.substring(0, 50)}${query.length > 50 ? "..." : ""}\n开始进行文本embedding处理`
          : `查询: ${query.substring(0, 50)}${query.length > 50 ? "..." : ""}`,
      );
    }

    if (knowledgeBaseEnabled) {
      console.log(`[RAG System] 知识库已启用，执行RAG检索...`);
      // 初始化知识库向量存储
      const vectorStore = await initKnowledgeBaseVectorStore(userId);

      // 添加思考过程：执行检索策略
      if (conversationId) {
        const { addStepToDatabase } = useThinkingProcessStore.getState();
        await addStepToDatabase(
          conversationId,
          "retrieval",
          "执行混合检索策略",
          retrievalStrategy === "hybrid"
            ? "并行执行语义相似度检索和关键词检索，然后融合结果"
            : retrievalStrategy === "semantic"
              ? "执行语义相似度检索，基于向量空间距离计算相关性"
              : "执行关键词检索，基于词频和匹配度计算相关性",
        );
      }

      console.log(`[RAG System] 执行${retrievalStrategy}检索...`);

      // 构建上下文增强的查询
      const enhancedQuery = buildEnhancedQuery(query, conversationHistory);

      // 添加思考过程：构建增强查询
      if (conversationId) {
        const { addStepToDatabase } = useThinkingProcessStore.getState();
        await addStepToDatabase(
          conversationId,
          "query",
          "构建增强查询",
          `基于对话历史构建上下文增强的查询`,
        );
      }

      console.log(`[RAG System] 增强查询: ${enhancedQuery}`);

      // 根据检索策略执行不同的检索方法
      switch (retrievalStrategy) {
        case "semantic":
          searchResults = await vectorStore.similaritySearch(
            enhancedQuery,
            3,
            minScore,
          );
          break;
        case "keyword":
          searchResults = await vectorStore.keywordSearch(
            enhancedQuery,
            3,
            minScore,
          );
          break;
        case "hybrid":
        default:
          searchResults = await vectorStore.hybridSearch(
            enhancedQuery,
            3,
            minScore,
            semanticWeight,
          );
          break;
      }

      // 添加思考过程：检索相关文档
      if (conversationId) {
        const totalDocs = vectorStore.documents.length;
        const docDetails =
          searchResults.length > 0
            ? `检索了${totalDocs}篇文档，根据${minScore}阈值筛选过滤并排序，得到${searchResults.length}个相关文档，相关性分数分别为${searchResults.map((r) => r.score.toFixed(2)).join(", ")}`
            : `检索了${totalDocs}篇文档，根据${minScore}阈值筛选过滤，未找到相关文档`;
        const docList = searchResults.map((r, index) => ({
          id: r.document.metadata?.documentId,
          title: r.document.metadata?.title || `文档 ${index + 1}`,
          score: r.score.toFixed(2),
        }));
        const { addStepToDatabase } = useThinkingProcessStore.getState();
        await addStepToDatabase(
          conversationId,
          "documents",
          "检索相关文档",
          JSON.stringify({ text: docDetails, docs: docList }),
        );
      }

      // 没找到文档,打日志,sentry todo
      console.log(`[RAG System] 找到 ${searchResults.length} 个相关文档`);
      searchResults.forEach((item, index) => {
        console.log(
          `[RAG System]   Doc ${index + 1}: score=${(item.score * 100).toFixed(2)}%, title=${item.document.metadata?.title}`,
        );
      });
    } else {
      console.log(`[RAG System] 知识库已禁用，直接使用LLM原生能力...`);
    }

    // 添加思考过程：生成动态提示词
    if (conversationId) {
      const { addStepToDatabase } = useThinkingProcessStore.getState();
      await addStepToDatabase(
        conversationId,
        "prompt",
        "生成动态提示词",
        knowledgeBaseEnabled
          ? "基于检索结果生成结构化提示词"
          : "基于用户查询生成提示词",
      );
    }

    console.log(`[RAG System] 生成动态prompt...`);
    // 使用promptLoader生成动态prompt
    const { systemPrompt, userPrompt } = promptLoader.generatePrompt(
      searchResults,
      query,
    );

    console.log(`[RAG System] 系统提示长度: ${systemPrompt.length} 字符`);
    console.log(`[RAG System] 用户提示长度: ${userPrompt.length} 字符`);

    // 添加思考过程：调用聊天API
    if (conversationId) {
      const { addStepToDatabase } = useThinkingProcessStore.getState();
      await addStepToDatabase(
        conversationId,
        "api",
        "调用聊天API",
        `使用${model}模型生成响应`,
      );
    }

    console.log(`[RAG System] 调用聊天API...`);
    // 调用API路由
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get chat response: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[RAG System] ===== RAG查询完成 =====`);
    return data.content;
  } catch (error) {
    console.error("[RAG System] 执行RAG查询时出错:", error);
    throw error;
  }
};

// 执行流式RAG查询
export const runRAGQueryStream = async (
  userId: string,
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  model: AIModel = "qwen-max",
  minScore: number = 0.6,
  retrievalStrategy: RetrievalStrategy = "hybrid",
  semanticWeight: number = 0.5,
  knowledgeBaseEnabled: boolean = true,
  conversationId?: Id<"aiConversations">,
): Promise<void> => {
  console.log(`[RAG System] ===== 执行流式RAG查询 =====`);
  console.log(`[RAG System] 用户: ${userId}`);
  console.log(`[RAG System] 查询: ${query}`);
  console.log(`[RAG System] 对话历史长度: ${conversationHistory.length}`);
  console.log(`[RAG System] 模型: ${model}`);
  console.log(`[RAG System] 最小相似度: ${minScore}`);
  console.log(`[RAG System] 检索策略: ${retrievalStrategy}`);
  console.log(`[RAG System] 语义权重: ${semanticWeight}`);

  try {
    let searchResults: Array<{ document: Document; score: number }> = [];

    // 先删除旧的思考过程步骤
    if (conversationId) {
      const deletedCount = await convex.mutation(
        api.aiChat.deleteThinkingSteps,
        {
          conversationId,
        },
      );
      console.log(`[RAG System] 删除了 ${deletedCount} 个旧的思考过程步骤`);

      // 清除本地状态中的步骤
      try {
        const { clearSteps } = useThinkingProcessStore.getState();
        clearSteps();
        console.log(`[RAG System] 清除了本地状态中的思考过程步骤`);
      } catch (error) {
        console.error(`[RAG System] 清除本地状态时出错:`, error);
      }

      // 添加思考过程：检查知识库状态
      const { addStepToDatabase } = useThinkingProcessStore.getState();
      await addStepToDatabase(
        conversationId,
        "knowledge-base",
        "检查知识库状态",
        knowledgeBaseEnabled
          ? "知识库已启用，准备执行RAG检索"
          : "知识库已禁用，直接使用LLM原生能力",
      );

      // 添加思考过程：开始执行文本Embedding
      await addStepToDatabase(
        conversationId,
        "start",
        "用户Query处理",
        knowledgeBaseEnabled
          ? `用户输入: ${query.substring(0, 50)}${query.length > 50 ? "..." : ""}\n开始进行query embedding处理`
          : `用户输入: ${query.substring(0, 50)}${query.length > 50 ? "..." : ""}`,
      );
    }

    if (knowledgeBaseEnabled) {
      console.log(`[RAG System] 知识库已启用，执行RAG检索...`);
      // 初始化知识库向量存储
      const vectorStore = await initKnowledgeBaseVectorStore(userId);

      // 添加思考过程：执行检索策略
      if (conversationId) {
        const { addStepToDatabase } = useThinkingProcessStore.getState();
        await addStepToDatabase(
          conversationId,
          "retrieval",
          "执行混合检索策略",
          retrievalStrategy === "hybrid"
            ? "并行执行语义相似度检索和关键词检索，然后融合结果"
            : retrievalStrategy === "semantic"
              ? "执行语义相似度检索，基于向量空间距离计算相关性"
              : "执行关键词检索，基于词频和匹配度计算相关性",
        );
      }

      console.log(`[RAG System] 执行${retrievalStrategy}检索...`);
      // 根据检索策略执行不同的检索方法
      switch (retrievalStrategy) {
        case "semantic":
          searchResults = await vectorStore.similaritySearch(
            query,
            3,
            minScore,
          );
          break;
        case "keyword":
          searchResults = await vectorStore.keywordSearch(query, 3, minScore);
          break;
        case "hybrid":
        default:
          searchResults = await vectorStore.hybridSearch(
            query,
            3,
            minScore,
            semanticWeight,
          );
          break;
      }

      // 添加思考过程：检索相关文档
      if (conversationId) {
        const totalDocs = vectorStore.documents.length;
        const docDetails =
          searchResults.length > 0
            ? `检索了${totalDocs}篇文档，根据${minScore}阈值筛选过滤并排序，得到${searchResults.length}个相关文档，相关性分数分别为${searchResults.map((r) => r.score.toFixed(2)).join(", ")}`
            : `检索了${totalDocs}篇文档，根据${minScore}阈值筛选过滤，未找到相关文档`;
        const docList = searchResults.map((r, index) => ({
          id: r.document.metadata?.documentId,
          title: r.document.metadata?.title || `文档 ${index + 1}`,
          score: r.score.toFixed(2),
        }));
        const { addStepToDatabase } = useThinkingProcessStore.getState();
        await addStepToDatabase(
          conversationId,
          "documents",
          "检索相关文档",
          JSON.stringify({ text: docDetails, docs: docList }),
        );
      }

      // 没找到文档,打日志,sentry todo
      console.log(`[RAG System] 找到 ${searchResults.length} 个相关文档`);
      searchResults.forEach((item, index) => {
        console.log(
          `[RAG System]   Doc ${index + 1}: score=${(item.score * 100).toFixed(2)}%, title=${item.document.metadata?.title}`,
        );
      });
    } else {
      console.log(`[RAG System] 知识库已禁用，直接使用LLM原生能力...`);
    }

    // 添加思考过程：生成动态提示词
    if (conversationId) {
      const { addStepToDatabase } = useThinkingProcessStore.getState();
      await addStepToDatabase(
        conversationId,
        "prompt",
        "生成动态提示词",
        knowledgeBaseEnabled
          ? "基于检索结果生成结构化提示词"
          : "基于用户查询生成提示词",
      );
    }

    console.log(`[RAG System] 生成动态prompt...`);
    // 使用promptLoader生成动态prompt
    const { systemPrompt, userPrompt } = promptLoader.generatePrompt(
      searchResults,
      query,
    );

    console.log(`[RAG System] 系统提示长度: ${systemPrompt.length} 字符`);
    console.log(`[RAG System] 用户提示长度: ${userPrompt.length} 字符`);

    // 添加思考过程：调用流式聊天API
    if (conversationId) {
      const { addStepToDatabase } = useThinkingProcessStore.getState();
      await addStepToDatabase(
        conversationId,
        "api",
        "调用流式聊天API",
        `使用${model}模型生成响应`,
      );
    }

    // 构建完整的消息数组
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: "user",
        content: userPrompt,
      },
    ];

    console.log(`[RAG System] 调用流式聊天API...`);
    // 调用API路由
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get chat response: ${response.statusText}`);
    }

    console.log(`[RAG System] 开始接收流式响应...`);
    // 处理流式响应
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error("Response body is not readable");
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          console.log(`[RAG System] ===== 流式RAG查询完成 =====`);
          onComplete();
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        onChunk(chunk);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("[RAG System] 执行流式RAG查询时出错:", error);
    onError(error as Error);
  }
};

// 清除向量存储缓存
export const clearVectorStoreCache = (userId: string): void => {
  console.log(`[RAG System] 清除向量存储缓存 - 用户: ${userId}`);
  chunkManager.clearChunksForUser(userId);
  // 同时清除EnhancedVectorStore实例缓存
  vectorStoreCache.delete(userId);
  console.log(`[RAG System] 已清除EnhancedVectorStore实例缓存`);
};

// 从知识库中移除文档并清除相关向量数据
export const removeDocumentFromKnowledgeBase = async (
  userId: string,
  documentId: string,
): Promise<void> => {
  console.log(`[RAG System] 从知识库中移除文档: ${documentId}`);

  // 直接调用Convex API删除数据库中的chunks
  try {
    await convex.mutation(api.vectorStore.deleteDocumentChunks, {
      documentId: documentId as any,
    });
    console.log(`[RAG System] 已从数据库中删除文档 ${documentId} 的chunks`);
  } catch (error) {
    console.error(`[RAG System] 删除文档 ${documentId} 的chunks时出错:`, error);
  }

  // 刷新内存中的chunks
  await chunkManager.refreshChunksForUser(userId);

  // 清除向量存储缓存
  clearVectorStoreCache(userId);

  console.log(`[RAG System] 已清除文档 ${documentId} 的向量数据`);
};

// 异步触发文档更新，不阻塞用户操作
export const triggerDocumentUpdate = async (
  userId: string,
  documentId: string,
  content: string,
  title: string,
): Promise<void> => {
  console.log(
    `[RAG System] 触发文档异步更新: documentId=${documentId}, title=${title}`,
  );

  try {
    const vectorStore = await initKnowledgeBaseVectorStore(userId, true);
    await vectorStore.updateDocument(
      userId,
      documentId,
      content,
      title,
      new CustomEmbeddings(),
      textSplitter,
    );

    // 刷新内存中的chunk
    await chunkManager.refreshChunksForUser(userId);
  } catch (error) {
    console.error("[RAG System] 异步更新文档时出错:", error);
  }
};
