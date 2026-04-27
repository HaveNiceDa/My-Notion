import { Document } from "@langchain/core/documents";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { promptLoader } from "@notion/ai/prompts";
import {
  type AIModel,
  DEFAULT_MODEL,
  getActualModelId,
  MODEL_DISPLAY_NAMES,
} from "@notion/ai/config";
import {
  getOrCreateVectorStore,
  computeContentHash,
  getCachedDocumentHash,
  setCachedDocumentHash,
} from "@notion/ai/server";

export type { AIModel };

import { buildEnhancedQuery } from "@notion/ai/rag";
import { extractTextFromDocument } from "@notion/ai/utils";
import type { FunctionArgs, FunctionReference } from "convex/server";

type ConvexClient = {
  query<Ref extends FunctionReference<"query">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<any>;
  mutation<Ref extends FunctionReference<"mutation">>(
    ref: Ref,
    args: FunctionArgs<Ref>,
  ): Promise<any>;
};

async function addThinkingStep(
  convex: ConvexClient,
  conversationId: string | Id<"aiConversations">,
  type: string,
  content: string,
  details?: string,
): Promise<void> {
  try {
    await convex.mutation(api.aiChat.addThinkingStep, {
      conversationId: conversationId as Id<"aiConversations">,
      type,
      content,
      details,
    });
  } catch (error) {
    console.error("Error adding thinking step to database:", error);
  }
}

export const initKnowledgeBaseVectorStore = async (
  convex: ConvexClient,
  userId: string,
  conversationId?: Id<"aiConversations">,
  skipDocumentCheck: boolean = false,
): Promise<ReturnType<typeof getOrCreateVectorStore>> => {
  console.log(
    `[RAG System] ===== 初始化知识库向量存储 - 用户: ${userId} =====`,
  );

  try {
    const vectorStore = await getOrCreateVectorStore(userId);

    if (skipDocumentCheck) {
      console.log(`[RAG System] 跳过文档检查，直接返回缓存的向量存储`);
      return vectorStore;
    }

    console.log(`[RAG System] 获取用户知识库文档...`);
    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "knowledge-base",
        "获取用户知识库文档",
      );
    }

    const documents = await convex.query(
      api.aiChat.getKnowledgeBaseDocumentsForRAG,
      {},
    );
    console.log(`[RAG System] 找到 ${documents.length} 个知识库文档`);

    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "knowledge-base",
        `找到 ${documents.length} 个知识库文档`,
      );
    }

    let reembeddedCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      if (!doc.content) continue;

      const text = extractTextFromDocument(doc.content);
      if (!text) continue;

      const currentHash = computeContentHash(text);
      const cachedHash = getCachedDocumentHash(userId, doc._id);

      if (cachedHash === currentHash) {
        skippedCount++;
        continue;
      }

      const needsReembed = await vectorStore.needsReembedding(
        doc._id,
        text,
        currentHash,
      );

      if (!needsReembed) {
        setCachedDocumentHash(userId, doc._id, currentHash);
        skippedCount++;
        console.log(`[RAG System] 文档无需重新嵌入: ${doc.title}`);
        continue;
      }

      console.log(`[RAG System] 文档需要重新嵌入: ${doc.title}`);
      reembeddedCount++;

      if (conversationId) {
        await addThinkingStep(
          convex,
          conversationId,
          "knowledge-base",
          `文档需要重新嵌入: ${doc.title}`,
        );
      }

      const { textSplitter } = await import("@notion/ai/rag");
      const splits = await textSplitter.splitText(text);
      console.log(`[RAG System] 文档分割为 ${splits.length} 个chunks`);

      const { CustomEmbeddings } = await import("@notion/ai/embeddings");
      const embeddings = await new CustomEmbeddings().embedDocuments(splits);

      const chunks = splits.map((split, index) => ({
        chunkIndex: index,
        pageContent: split,
        metadata: { documentId: doc._id, title: doc.title },
        embedding: embeddings[index],
      }));

      await vectorStore.addDocumentChunks(userId, doc._id, chunks, currentHash);
      setCachedDocumentHash(userId, doc._id, currentHash);

      console.log(`[RAG System] 文档嵌入完成: ${doc.title}`);
    }

    console.log(
      `[RAG System] ===== 向量存储初始化完成 (重新嵌入: ${reembeddedCount}, 跳过: ${skippedCount}) =====`,
    );

    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "knowledge-base",
        `向量存储初始化完成`,
        `重新嵌入: ${reembeddedCount}, 跳过: ${skippedCount}`,
      );
    }

    return vectorStore;
  } catch (error) {
    console.error("[RAG System] 初始化向量存储时出错:", error);
    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "error",
        `初始化向量存储时出错`,
        error instanceof Error ? error.message : String(error),
      );
    }
    throw error;
  }
};

export const runRAGQuery = async (
  convex: ConvexClient,
  userId: string,
  query: string,
  model: AIModel = DEFAULT_MODEL,
  minScore: number = 0.6,
  conversationHistory: Array<{ role: string; content: string }> = [],
  knowledgeBaseEnabled: boolean = true,
  conversationId?: Id<"aiConversations">,
): Promise<string> => {
  console.log(`[RAG System] ===== 执行RAG查询 =====`);
  console.log(`[RAG System] 用户: ${userId}`);
  console.log(`[RAG System] 查询: ${query}`);
  console.log(`[RAG System] 模型: ${model}`);
  console.log(`[RAG System] 最小相似度: ${minScore}`);

  try {
    let searchResults: Array<{ document: Document; score: number }> = [];

    if (conversationId) {
      const deletedCount = await convex.mutation(
        api.aiChat.deleteThinkingSteps,
        { conversationId },
      );
      console.log(`[RAG System] 删除了 ${deletedCount} 个旧的思考过程步骤`);
    }

    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "knowledge-base",
        "检查知识库状态",
        `知识库已启用，准备执行RAG检索`,
      );
    }

    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "query",
        "用户Query处理",
        `用户输入: ${query}\n开始进行query embedding处理`,
      );
    }

    if (knowledgeBaseEnabled) {
      console.log(`[RAG System] 知识库已启用，执行RAG检索...`);

      const vectorStore = await initKnowledgeBaseVectorStore(
        convex,
        userId,
        conversationId,
      );

      console.log(`[RAG System] 执行语义检索...`);
      if (conversationId) {
        await addThinkingStep(
          convex,
          conversationId,
          "retrieval",
          "执行语义检索策略",
          `使用向量嵌入进行语义相似度检索`,
        );
      }

      const enhancedQuery = buildEnhancedQuery(query, conversationHistory);
      console.log(`[RAG System] 增强查询: ${enhancedQuery}`);

      searchResults = await vectorStore.similaritySearch(
        enhancedQuery,
        3,
        minScore,
      );

      if (conversationId && searchResults.length > 0) {
        const docs = searchResults.map((result) => ({
          id: result.document.metadata?.documentId || "",
          title: result.document.metadata?.title || "",
          score: result.score.toFixed(2),
        }));
        const text = `检索了${docs.length}篇文档，根据${minScore}阈值筛选过滤并排序，得到${docs.length}个相关文档，相关性分数分别为${docs.map((d) => d.score).join(", ")}`;
        const details = JSON.stringify({ text, docs });
        await addThinkingStep(
          convex,
          conversationId,
          "documents",
          "检索相关文档",
          details,
        );
      } else if (conversationId) {
        await addThinkingStep(
          convex,
          conversationId,
          "documents",
          "检索相关文档",
          "未找到相关文档",
        );
      }
    }

    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "prompt",
        "生成动态提示词",
        "基于检索结果生成结构化提示词",
      );
    }
    const { systemPrompt, userPrompt } = promptLoader.generatePrompt(
      searchResults,
      query,
    );

    console.log(`[RAG System] 系统提示长度: ${systemPrompt.length} 字符`);
    console.log(`[RAG System] 用户提示长度: ${userPrompt.length} 字符`);

    console.log(`[RAG System] 调用聊天API...`);
    const displayModelName = MODEL_DISPLAY_NAMES[model] || model;
    if (conversationId) {
      await addThinkingStep(
        convex,
        conversationId,
        "api",
        "调用流式聊天API",
        `使用${displayModelName}模型生成响应`,
      );
    }
    const apiUrl = process.env.NEXT_PUBLIC_APP_URL
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/chat`
      : `http://localhost:3000/api/chat`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: getActualModelId(model),
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
