import { Document } from "@langchain/core/documents";
import { CustomEmbeddings } from "../embeddings";
import { QdrantVectorStoreWrapper } from "../rag";
import { promptLoader } from "../prompts";
import { getActualModelId, MODEL_DISPLAY_NAMES, type AIModel } from "../config";
import { streamChat } from "./chat";
import type {
  AIStreamCallback,
  ChatMessage,
  RAGOptions,
} from "./types";
import type { DataSource } from "./data-source";

const vectorStoreCache = new Map<string, QdrantVectorStoreWrapper>();

async function getVectorStore(userId: string): Promise<QdrantVectorStoreWrapper> {
  const cached = vectorStoreCache.get(userId);
  if (cached) return cached;

  const vectorStore = new QdrantVectorStoreWrapper(
    userId,
    new CustomEmbeddings(),
  );
  await vectorStore.ensureCollectionExists();
  vectorStoreCache.set(userId, vectorStore);
  return vectorStore;
}

function emitThinkingStep(
  onEvent: AIStreamCallback,
  dataSource: DataSource | undefined,
  conversationId: string | undefined,
  stepType: string,
  content: string,
  details?: string,
): void {
  onEvent({ type: "thinking_step", step_type: stepType, content, details });

  if (conversationId && dataSource?.addThinkingStep) {
    dataSource.addThinkingStep(conversationId, stepType, content, details).catch(() => {});
  }
}

export async function streamRAG(
  query: string,
  options: RAGOptions,
  onEvent: AIStreamCallback,
): Promise<void> {
  const {
    userId,
    model,
    conversationHistory = [],
    minScore = 0.6,
    knowledgeBaseEnabled = true,
    conversationId,
    enableThinking = false,
    thinkingBudget,
  } = options;

  const dataSource = options.dataSource as DataSource | undefined;
  const actualModelId = typeof model === "string" && (model as any) in MODEL_DISPLAY_NAMES
    ? getActualModelId(model as AIModel)
    : model;

  let searchResults: Array<{ document: Document; score: number }> = [];

  if (conversationId && dataSource?.deleteThinkingSteps) {
    dataSource.deleteThinkingSteps(conversationId).catch(() => {});
  }

  emitThinkingStep(
    onEvent,
    dataSource,
    conversationId,
    "knowledge-base",
    "检查知识库状态",
    "知识库已启用，准备执行RAG检索",
  );

  emitThinkingStep(
    onEvent,
    dataSource,
    conversationId,
    "query",
    "用户Query处理",
    `用户输入: ${query}\n开始进行query embedding处理`,
  );

  if (knowledgeBaseEnabled) {
    try {
      const vectorStore = await getVectorStore(userId);

      emitThinkingStep(
        onEvent,
        dataSource,
        conversationId,
        "retrieval",
        "执行语义检索策略",
        "使用向量嵌入进行语义相似度检索",
      );

      try {
        searchResults = await vectorStore.similaritySearch(query, 3, minScore);

        if (searchResults.length > 0) {
          const docs = searchResults.map((result) => ({
            id: result.document.metadata?.documentId || "",
            title: result.document.metadata?.title || "",
            score: result.score.toFixed(2),
          }));
          const text = `检索了${docs.length}篇文档，根据${minScore}阈值筛选过滤并排序，得到${docs.length}个相关文档，相关性分数分别为${docs.map((d) => d.score).join(", ")}`;
          const details = JSON.stringify({ text, docs });

          emitThinkingStep(
            onEvent,
            dataSource,
            conversationId,
            "documents",
            "检索相关文档",
            details,
          );
        } else {
          emitThinkingStep(
            onEvent,
            dataSource,
            conversationId,
            "documents",
            "检索相关文档",
            "未找到相关文档",
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        emitThinkingStep(
          onEvent,
          dataSource,
          conversationId,
          "error",
          "执行检索时出错",
          errorMsg,
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      emitThinkingStep(
        onEvent,
        dataSource,
        conversationId,
        "error",
        "知识库检索出错",
        errorMsg,
      );
    }
  }

  emitThinkingStep(
    onEvent,
    dataSource,
    conversationId,
    "prompt",
    "生成动态提示词",
    "基于检索结果生成结构化提示词",
  );

  const { systemPrompt, userPrompt } = promptLoader.generatePrompt(
    searchResults,
    query,
  );

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userPrompt },
  ];

  const displayModelName = (MODEL_DISPLAY_NAMES as any)[model] || model;
  emitThinkingStep(
    onEvent,
    dataSource,
    conversationId,
    "api",
    "调用流式聊天API",
    `使用${displayModelName}模型生成响应`,
  );

  await streamChat(
    messages,
    {
      model: actualModelId,
      enableThinking,
      thinkingBudget,
    },
    onEvent,
  );
}
