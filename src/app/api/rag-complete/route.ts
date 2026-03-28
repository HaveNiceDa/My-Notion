import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CustomEmbeddings } from "@/src/lib/rag/customEmbeddings";
import { QdrantVectorStoreWrapper } from "@/src/lib/rag/qdrantVectorStore";
import { promptLoader } from "@/src/lib/prompt/promptLoader";

// 初始化Convex客户端
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// 添加思考过程到数据库
async function addThinkingStep(
  conversationId: string | Id<'aiConversations'>,
  type: string,
  content: string,
  details?: string
): Promise<void> {
  try {
    await convex.mutation(api.aiChat.addThinkingStep, {
      conversationId: conversationId as Id<'aiConversations'>,
      type,
      content,
      details,
    });
  } catch (error) {
    console.error('Error adding thinking step to database:', error);
  }
}

type AIModel = "qwen-plus" | "qwen-max" | "qwen3-coder-plus";
type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

// 文档分割器
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 250,
  chunkOverlap: 40,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

import { extractTextFromDocument } from "@/src/lib/utils/textExtractor";

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

// 初始化知识库向量存储
const initKnowledgeBaseVectorStore = async (
  userId: string,
  conversationId?: Id<'aiConversations'>,
  skipDocumentCheck: boolean = false,
): Promise<QdrantVectorStoreWrapper> => {
  console.log(
    `[RAG System] ===== 初始化知识库向量存储 - 用户: ${userId} =====`,
  );

  try {
    console.log(`[RAG System] 获取用户知识库文档...`);
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", "获取用户知识库文档");
    }
    // 获取用户知识库文档
    const documents = await convex.query(
      api.aiChat.getKnowledgeBaseDocumentsForRAG,
      {
        userId,
      },
    );
    console.log(`[RAG System] 找到 ${documents.length} 个知识库文档`);
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", `找到 ${documents.length} 个知识库文档`);
    }

    // 创建QdrantVectorStoreWrapper实例
    console.log(`[RAG System] 创建QdrantVectorStoreWrapper实例...`);
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", "创建QdrantVectorStoreWrapper实例");
    }
    const vectorStore = new QdrantVectorStoreWrapper(
      userId,
      new CustomEmbeddings(),
    );

    // 确保collection存在
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", "确保collection存在");
    }
    await vectorStore.ensureCollectionExists();
    console.log(`[RAG System] Qdrant collection 准备就绪`);
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", "Qdrant collection 准备就绪");
    }

    if (!skipDocumentCheck) {
      console.log(`[RAG System] 检查文档是否需要更新...`);
      if (conversationId) {
        await addThinkingStep(conversationId, "knowledge-base", "检查文档是否需要更新");
      }
      for (const doc of documents) {
        if (doc.content) {
          console.log(`[RAG System] 检查文档: ${doc.title} (${doc._id})`);
          if (conversationId) {
            await addThinkingStep(conversationId, "knowledge-base", `检查文档: ${doc.title}`);
          }
          const text = extractTextFromDocument(doc.content);
          if (text) {
            console.log(`[RAG System] 检查是否需要重新嵌入...`);
            if (conversationId) {
              await addThinkingStep(conversationId, "knowledge-base", `检查是否需要重新嵌入`);
            }
            const needsReembed = await vectorStore.needsReembedding(
              doc._id,
              text,
            );

            if (needsReembed) {
              console.log(`[RAG System] 文档需要重新嵌入，开始处理...`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `文档需要重新嵌入，开始处理`);
              }

              console.log(`[RAG System] 分割文档为chunks...`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `分割文档为chunks`);
              }
              const splits = await textSplitter.splitText(text);
              console.log(`[RAG System] 文档分割为 ${splits.length} 个chunks`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `文档分割为 ${splits.length} 个chunks`);
              }

              console.log(`[RAG System] 生成embeddings...`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `生成embeddings`);
              }
              const embeddings = await new CustomEmbeddings().embedDocuments(
                splits,
              );

              const chunks = splits.map((split, index) => ({
                chunkIndex: index,
                pageContent: split,
                metadata: { documentId: doc._id, title: doc.title },
                embedding: embeddings[index],
              }));

              console.log(`[RAG System] 保存chunks到Qdrant...`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `保存chunks到Qdrant`);
              }
              await vectorStore.addDocumentChunks(userId, doc._id, chunks);

              console.log(`[RAG System] 文档嵌入完成: ${doc.title}`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `文档嵌入完成: ${doc.title}`);
              }
            } else {
              console.log(`[RAG System] 文档无需重新嵌入: ${doc.title}`);
              if (conversationId) {
                await addThinkingStep(conversationId, "knowledge-base", `文档无需重新嵌入: ${doc.title}`);
              }
            }
          }
        }
      }
    }

    console.log(`[RAG System] ===== 向量存储初始化完成 =====`);
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", `向量存储初始化完成`);
    }
    return vectorStore;
  } catch (error) {
    console.error("[RAG System] 初始化向量存储时出错:", error);
    if (conversationId) {
      await addThinkingStep(conversationId, "error", `初始化向量存储时出错`, error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
};

// 执行RAG查询
const runRAGQuery = async (
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
      // 不添加删除步骤到思考过程
    }

    // 步骤1: 检查知识库状态
    if (conversationId) {
      await addThinkingStep(conversationId, "knowledge-base", "检查知识库状态", `知识库已启用，准备执行RAG检索`);
    }

    // 步骤2: 用户Query处理
    if (conversationId) {
      await addThinkingStep(conversationId, "query", "用户Query处理", `用户输入: ${query}\n开始进行query embedding处理`);
    }

    if (knowledgeBaseEnabled) {
      console.log(`[RAG System] 知识库已启用，执行RAG检索...`);
      
      // 初始化知识库向量存储
      const vectorStore = await initKnowledgeBaseVectorStore(userId, conversationId);

      // 步骤3: 执行混合检索策略
      console.log(`[RAG System] 执行${retrievalStrategy}检索...`);
      if (conversationId) {
        await addThinkingStep(conversationId, "retrieval", "执行混合检索策略", `并行执行语义相似度检索和关键词检索，然后融合结果`);
      }

      // 构建上下文增强的查询
      const enhancedQuery = buildEnhancedQuery(query, conversationHistory);
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

      // 步骤4: 检索相关文档
      if (conversationId && searchResults.length > 0) {
        const docs = searchResults.map((result) => ({
          id: result.document.metadata?.documentId || "",
          title: result.document.metadata?.title || "",
          score: result.score.toFixed(3)
        }));
        const docDetails = docs.map(doc => `${doc.title} (相关性: ${doc.score})`).join('\n');
        await addThinkingStep(conversationId, "documents", "检索相关文档", `检索了${docs.length}篇文档，根据${minScore}阈值筛选过滤并排序，得到${docs.length}个相关文档，相关性分数分别为${docs.map(d => d.score).join(', ')}\n${docDetails}`);
      } else if (conversationId) {
        await addThinkingStep(conversationId, "documents", "检索相关文档", "未找到相关文档");
      }
    }

    // 步骤5: 生成动态提示词
    if (conversationId) {
      await addThinkingStep(conversationId, "prompt", "生成动态提示词", "基于检索结果生成结构化提示词");
    }
    const { systemPrompt, userPrompt } = promptLoader.generatePrompt(
      searchResults,
      query,
    );

    console.log(`[RAG System] 系统提示长度: ${systemPrompt.length} 字符`);
    console.log(`[RAG System] 用户提示长度: ${userPrompt.length} 字符`);

    // 步骤6: 调用流式聊天API
    console.log(`[RAG System] 调用聊天API...`);
    if (conversationId) {
      await addThinkingStep(conversationId, "api", "调用流式聊天API", `使用${model}模型生成响应`);
    }
    // 调用API路由
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/chat` : `http://localhost:3000/api/chat`;
    const response = await fetch(apiUrl, {
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

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[RAG API] 接收到请求: ${action}`);

    switch (action) {
      case "runRAGQuery":
        const {
          userId,
          query,
          model,
          minScore,
          retrievalStrategy,
          semanticWeight,
          conversationHistory,
          knowledgeBaseEnabled,
          conversationId,
        } = params;

        const answer = await runRAGQuery(
          userId,
          query,
          model,
          minScore,
          retrievalStrategy,
          semanticWeight,
          conversationHistory,
          knowledgeBaseEnabled,
          conversationId,
        );

        return NextResponse.json({ success: true, answer });

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG API error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
