import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { CustomEmbeddings } from "./customEmbeddings";
import { SimpleVectorStore } from "./simpleVectorStore";

type AIModel = "qwen-plus" | "qwen-max" | "qwen3-coder-plus";

console.log("[RAG System] 加载RAG模块...");

// 初始化Convex客户端
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// 文档分割器 - 优化配置以获得更好的检索效果
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 300,
  chunkOverlap: 30,
  separators: ["\n\n", "\n", "。", "！", "？", "；", "，", " ", ""],
});

console.log(`[RAG System] 文本分割器配置: chunkSize=300, chunkOverlap=30`);

// 向量存储缓存
const vectorStoreCache = new Map<string, SimpleVectorStore>();

// 提取文档文本内容
const extractTextFromDocument = (content: string): string => {
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

// 初始化向量存储
export const initVectorStore = async (
  userId: string,
): Promise<SimpleVectorStore> => {
  console.log(`[RAG System] ===== 初始化向量存储 - 用户: ${userId} =====`);

  // 检查缓存
  if (vectorStoreCache.has(userId)) {
    console.log(`[RAG System] 使用缓存的向量存储`);
    return vectorStoreCache.get(userId)!;
  }

  try {
    console.log(`[RAG System] 获取用户文档...`);
    // 获取用户文档
    const documents = await convex.query(api.aiChat.getDocumentsForRAG, {
      userId,
    });
    console.log(`[RAG System] 找到 ${documents.length} 个文档`);

    // 处理文档内容
    const texts = [];
    for (const doc of documents) {
      if (doc.content) {
        console.log(`[RAG System] 处理文档: ${doc.title} (${doc._id})`);
        const text = extractTextFromDocument(doc.content);
        if (text) {
          console.log(`[RAG System] 文档文本长度: ${text.length} 字符`);
          texts.push({
            pageContent: text,
            metadata: { documentId: doc._id, title: doc.title },
          });
        } else {
          console.log(`[RAG System] 文档无内容，跳过: ${doc.title}`);
        }
      }
    }

    console.log(`[RAG System] 开始文本分割...`);
    // 分割文本
    const allSplits = [];
    for (const item of texts) {
      const splits = await textSplitter.splitText(item.pageContent);
      console.log(
        `[RAG System] 文档 \"${item.metadata.title}\" 分割为 ${splits.length} 个chunks`,
      );
      for (const split of splits) {
        allSplits.push({
          pageContent: split,
          metadata: item.metadata,
        });
      }
    }
    console.log(`[RAG System] 总共 ${allSplits.length} 个chunks`);

    console.log(`[RAG System] 创建向量存储...`);
    // 创建向量存储（使用简单内存存储，无需额外服务器）
    const vectorStore = new SimpleVectorStore(new CustomEmbeddings());
    console.log(`[RAG System] 开始添加文档到向量存储...`);
    await vectorStore.addDocuments(allSplits);
    console.log(`[RAG System] 文档添加完成`);

    // 缓存向量存储
    vectorStoreCache.set(userId, vectorStore);
    console.log(`[RAG System] ===== 向量存储初始化完成 =====`);

    return vectorStore;
  } catch (error) {
    console.error("[RAG System] 初始化向量存储时出错:", error);
    throw error;
  }
};

// 执行RAG查询
export const runRAGQuery = async (
  userId: string,
  query: string,
  model: AIModel = "qwen-max",
  minScore: number = 0.7,
): Promise<string> => {
  console.log(`[RAG System] ===== 执行RAG查询 =====`);
  console.log(`[RAG System] 用户: ${userId}`);
  console.log(`[RAG System] 查询: ${query}`);
  console.log(`[RAG System] 模型: ${model}`);
  console.log(`[RAG System] 最小相似度: ${minScore}`);

  try {
    // 初始化向量存储
    const vectorStore = await initVectorStore(userId);

    console.log(`[RAG System] 执行相似度搜索...`);
    // 检索相关文档，设置相似度阈值
    const searchResults = await vectorStore.similaritySearch(
      query,
      3,
      minScore,
    );

    // 没找到文档,打日志,sentry todo
    console.log(`[RAG System] 找到 ${searchResults.length} 个相关文档`);
    searchResults.forEach((item, index) => {
      console.log(
        `[RAG System]   Doc ${index + 1}: score=${(item.score * 100).toFixed(2)}%, title=${item.document.metadata?.title}`,
      );
    });

    // 构建上下文，不包含相似度信息
    let context = "";
    if (searchResults.length > 0) {
      context = searchResults
        .map((item) => item.document.pageContent)
        .join("\n\n---\n\n");
      console.log(`[RAG System] 构建上下文完成，长度: ${context.length} 字符`);
    }

    console.log(`[RAG System] 构建系统提示...`);
    // 构建系统提示
    const systemPrompt = context
      ? `请根据以下上下文回答用户问题。如果上下文中没有相关信息，请明确说明。

上下文：
${context}

问题：${query}`
      : `请回答用户问题。

问题：${query}`;

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
            content: query,
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
  minScore: number = 0.7,
): Promise<void> => {
  console.log(`[RAG System] ===== 执行流式RAG查询 =====`);
  console.log(`[RAG System] 用户: ${userId}`);
  console.log(`[RAG System] 查询: ${query}`);
  console.log(`[RAG System] 对话历史长度: ${conversationHistory.length}`);
  console.log(`[RAG System] 模型: ${model}`);
  console.log(`[RAG System] 最小相似度: ${minScore}`);

  try {
    // 初始化向量存储
    const vectorStore = await initVectorStore(userId);

    console.log(`[RAG System] 执行相似度搜索...`);
    // 检索相关文档，设置相似度阈值
    const searchResults = await vectorStore.similaritySearch(
      query,
      3,
      minScore,
    );

    // 没找到文档,打日志,sentry todo
    console.log(`[RAG System] 找到 ${searchResults.length} 个相关文档`);
    searchResults.forEach((item, index) => {
      console.log(
        `[RAG System]   Doc ${index + 1}: score=${(item.score * 100).toFixed(2)}%, title=${item.document.metadata?.title}`,
      );
    });

    // 构建上下文，不包含相似度信息
    let context = "";
    if (searchResults.length > 0) {
      context = searchResults
        .map((item) => item.document.pageContent)
        .join("\n\n---\n\n");
      console.log(`[RAG System] 构建上下文完成，长度: ${context.length} 字符`);
    }

    console.log(`[RAG System] 构建系统提示...`);
    // 构建系统提示
    const systemPrompt = context
      ? `请根据以下上下文回答用户问题。如果上下文中没有相关信息，请明确说明。

上下文：
${context}

问题：${query}`
      : `请回答用户问题。

问题：${query}`;

    // 构建完整的消息数组
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: "user",
        content: query,
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
  vectorStoreCache.delete(userId);
};
