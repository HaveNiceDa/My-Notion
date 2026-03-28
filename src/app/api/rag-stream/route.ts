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

  // 创建一个ReadableStream来处理响应，使用Server-Sent Events (SSE)
  return new ReadableStream({
    async start(controller) {
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
          // 推送思考过程步骤到前端
          controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
            type: "knowledge-base",
            content: "检查知识库状态",
            details: `知识库已启用，准备执行RAG检索`
          })}\n\n`));
        }

        // 步骤2: 用户Query处理
        if (conversationId) {
          await addThinkingStep(conversationId, "query", "用户Query处理", `用户输入: ${query}\n开始进行query embedding处理`);
          // 推送思考过程步骤到前端
          controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
            type: "query",
            content: "用户Query处理",
            details: `用户输入: ${query}\n开始进行query embedding处理`
          })}\n\n`));
        }

        if (knowledgeBaseEnabled) {
          console.log(`[RAG System] 知识库已启用，执行RAG检索...`);
          
          try {
            // 初始化知识库向量存储
            const vectorStore = await initKnowledgeBaseVectorStore(userId, conversationId);

            // 步骤3: 执行混合检索策略
            console.log(`[RAG System] 执行${retrievalStrategy}检索...`);
            if (conversationId) {
              await addThinkingStep(conversationId, "retrieval", "执行混合检索策略", `并行执行语义相似度检索和关键词检索，然后融合结果`);
              // 推送思考过程步骤到前端
              controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
                type: "retrieval",
                content: "执行混合检索策略",
                details: `并行执行语义相似度检索和关键词检索，然后融合结果`
              })}\n\n`));
            }

            // 根据检索策略执行不同的检索方法
            try {
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

              // 步骤4: 检索相关文档
              if (conversationId && searchResults.length > 0) {
                const docs = searchResults.map((result) => ({
                  id: result.document.metadata?.documentId || "",
                  title: result.document.metadata?.title || "",
                  score: result.score.toFixed(3)
                }));
                const text = `检索了${docs.length}篇文档，根据${minScore}阈值筛选过滤并排序，得到${docs.length}个相关文档，相关性分数分别为${docs.map(d => d.score).join(', ')}`;
                const details = JSON.stringify({ text, docs });
                await addThinkingStep(conversationId, "documents", "检索相关文档", details);
                // 推送思考过程步骤到前端
                controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
                  type: "documents",
                  content: "检索相关文档",
                  details: details
                })}\n\n`));
              } else if (conversationId) {
                await addThinkingStep(conversationId, "documents", "检索相关文档", "未找到相关文档");
                // 推送思考过程步骤到前端
                controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
                  type: "documents",
                  content: "检索相关文档",
                  details: "未找到相关文档"
                })}\n\n`));
              }
            } catch (error) {
              console.error("[RAG System] 执行检索时出错:", error);
              if (conversationId) {
                await addThinkingStep(conversationId, "error", "执行检索时出错", error instanceof Error ? error.message : String(error));
                // 推送错误信息到前端
                controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
                  type: "error",
                  content: "执行检索时出错",
                  details: error instanceof Error ? error.message : String(error)
                })}\n\n`));
              }
              // 继续执行，不中断流程
            }
          } catch (error) {
            console.error("[RAG System] 知识库检索出错:", error);
            if (conversationId) {
              await addThinkingStep(conversationId, "error", "知识库检索出错", error instanceof Error ? error.message : String(error));
              // 推送错误信息到前端
              controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
                type: "error",
                content: "知识库检索出错",
                details: error instanceof Error ? error.message : String(error)
              })}\n\n`));
            }
            // 继续执行，不中断流程
          }
        }

        // 步骤5: 生成动态提示词
        if (conversationId) {
          await addThinkingStep(conversationId, "prompt", "生成动态提示词", "基于检索结果生成结构化提示词");
          // 推送思考过程步骤到前端
          controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
            type: "prompt",
            content: "生成动态提示词",
            details: "基于检索结果生成结构化提示词"
          })}\n\n`));
        }
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

        // 步骤6: 调用流式聊天API
        console.log(`[RAG System] 调用流式聊天API...`);
        if (conversationId) {
          await addThinkingStep(conversationId, "api", "调用流式聊天API", `使用${model}模型生成响应`);
          // 推送思考过程步骤到前端
          controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
            type: "api",
            content: "调用流式聊天API",
            details: `使用${model}模型生成响应`
          })}\n\n`));
        }

        try {
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

          // 读取并转发聊天API的响应
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[RAG System] ===== 流式RAG查询完成 =====`);
              break;
            }
            // 推送聊天API的响应到前端，使用SSE格式
            controller.enqueue(new TextEncoder().encode(`event: chatResponse\ndata: ${new TextDecoder().decode(value)}\n\n`));
          }

          reader.releaseLock();
        } catch (error) {
          console.error("[RAG System] 调用聊天API出错:", error);
          if (conversationId) {
            await addThinkingStep(conversationId, "error", "调用聊天API出错", error instanceof Error ? error.message : String(error));
            // 推送错误信息到前端
            controller.enqueue(new TextEncoder().encode(`event: thinkingStep\ndata: ${JSON.stringify({
              type: "error",
              content: "调用聊天API出错",
              details: error instanceof Error ? error.message : String(error)
            })}\n\n`));
          }
          // 推送错误信息到前端
          controller.enqueue(new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({
            message: error instanceof Error ? error.message : String(error)
          })}\n\n`));
        }

        // 推送结束事件到前端
        controller.enqueue(new TextEncoder().encode(`event: end\ndata: {}\n\n`));
        controller.close();
      } catch (error) {
        console.error("[RAG System] 执行流式RAG查询时出错:", error);
        // 推送错误信息到前端
        controller.enqueue(new TextEncoder().encode(`event: error\ndata: ${JSON.stringify({
          message: error instanceof Error ? error.message : String(error)
        })}\n\n`));
        controller.close();
      }
    },
  });
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
