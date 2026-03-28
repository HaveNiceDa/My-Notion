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

type AIModel = "qwen-plus" | "qwen-max" | "qwen3-coder-plus";
type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

// 文档分割器
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 250,
  chunkOverlap: 40,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

import { extractTextFromDocument } from "@/src/lib/utils/textExtractor";

// 初始化知识库向量存储
const initKnowledgeBaseVectorStore = async (
  userId: string,
  skipDocumentCheck: boolean = false,
): Promise<QdrantVectorStoreWrapper> => {
  console.log(
    `[RAG System] ===== 初始化知识库向量存储 - 用户: ${userId} =====`,
  );

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

    // 创建QdrantVectorStoreWrapper实例
    console.log(`[RAG System] 创建QdrantVectorStoreWrapper实例...`);
    const vectorStore = new QdrantVectorStoreWrapper(
      userId,
      new CustomEmbeddings(),
    );

    // 确保collection存在
    await vectorStore.ensureCollectionExists();
    console.log(`[RAG System] Qdrant collection 准备就绪`);

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

              console.log(`[RAG System] 保存chunks到Qdrant...`);
              await vectorStore.addDocumentChunks(userId, doc._id, chunks);

              console.log(`[RAG System] 文档嵌入完成: ${doc.title}`);
            } else {
              console.log(`[RAG System] 文档无需重新嵌入: ${doc.title}`);
            }
          }
        }
      }
    }

    console.log(`[RAG System] ===== 向量存储初始化完成 =====`);
    return vectorStore;
  } catch (error) {
    console.error("[RAG System] 初始化向量存储时出错:", error);
    throw error;
  }
};

// 执行流式RAG查询
const runRAGQueryStream = async (
  userId: string,
  query: string,
  conversationHistory: Array<{ role: string; content: string }>,
  model: AIModel = "qwen-max",
  minScore: number = 0.6,
  retrievalStrategy: RetrievalStrategy = "hybrid",
  semanticWeight: number = 0.5,
  knowledgeBaseEnabled: boolean = true,
  conversationId?: Id<"aiConversations">,
): Promise<ReadableStream> => {
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
    }

    if (knowledgeBaseEnabled) {
      console.log(`[RAG System] 知识库已启用，执行RAG检索...`);
      // 初始化知识库向量存储
      const vectorStore = await initKnowledgeBaseVectorStore(userId);

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
    }

    // 生成提示词
    const { systemPrompt, userPrompt } = promptLoader.generatePrompt(
      searchResults,
      query,
    );

    console.log(`[RAG System] 系统提示长度: ${systemPrompt.length} 字符`);
    console.log(`[RAG System] 用户提示长度: ${userPrompt.length} 字符`);

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
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/chat` : `http://localhost:3000/api/chat`;
    const response = await fetch(apiUrl, {
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
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    // 创建一个新的可读流，将聊天API的响应流式传递给客户端
    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[RAG System] ===== 流式RAG查询完成 =====`);
              controller.close();
              break;
            }
            controller.enqueue(value);
          }
        } catch (error) {
          console.error("[RAG System] 处理流式响应时出错:", error);
          controller.error(error);
        } finally {
          reader.releaseLock();
        }
      },
    });

    return stream;
  } catch (error) {
    console.error("[RAG System] 执行流式RAG查询时出错:", error);
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
      case "runRAGQueryStream":
        const {
          userId,
          query,
          conversationHistory,
          model,
          minScore,
          retrievalStrategy,
          semanticWeight,
          knowledgeBaseEnabled,
          conversationId,
        } = params;

        const stream = await runRAGQueryStream(
          userId,
          query,
          conversationHistory,
          model,
          minScore,
          retrievalStrategy,
          semanticWeight,
          knowledgeBaseEnabled,
          conversationId,
        );

        return new NextResponse(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG API error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
