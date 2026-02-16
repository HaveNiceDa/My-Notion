import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { CustomEmbeddings } from "./customEmbeddings";
import { SimpleVectorStore } from "./simpleVectorStore";

// 初始化Convex客户端
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// 文档分割器
const textSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000,
  chunkOverlap: 200,
});

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
  // 检查缓存
  if (vectorStoreCache.has(userId)) {
    return vectorStoreCache.get(userId)!;
  }

  try {
    // 获取用户文档
    const documents = await convex.query(api.documents.getDocumentsForRAG, {
      userId,
    });

    // 处理文档内容
    const texts = [];
    for (const doc of documents) {
      if (doc.content) {
        const text = extractTextFromDocument(doc.content);
        if (text) {
          texts.push({
            pageContent: text,
            metadata: { documentId: doc._id, title: doc.title },
          });
        }
      }
    }

    // 分割文本
    const allSplits = [];
    for (const item of texts) {
      const splits = await textSplitter.splitText(item.pageContent);
      for (const split of splits) {
        allSplits.push({
          pageContent: split,
          metadata: item.metadata,
        });
      }
    }

    // 创建向量存储（使用简单内存存储，无需额外服务器）
    const vectorStore = new SimpleVectorStore(new CustomEmbeddings());
    await vectorStore.addDocuments(allSplits);

    // 缓存向量存储
    vectorStoreCache.set(userId, vectorStore);

    return vectorStore;
  } catch (error) {
    console.error("Error initializing vector store:", error);
    throw error;
  }
};

// 执行RAG查询
export const runRAGQuery = async (
  userId: string,
  query: string,
): Promise<string> => {
  try {
    // 初始化向量存储
    const vectorStore = await initVectorStore(userId);

    // 检索相关文档
    const relevantDocs = await vectorStore.similaritySearch(query, 3);

    // 构建上下文
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // 构建系统提示
    const systemPrompt = `请根据以下上下文回答用户问题：\n\n上下文：${context}\n\n`;

    // 调用API路由
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
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
    return data.content;
  } catch (error) {
    console.error("Error running RAG query:", error);
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
): Promise<void> => {
  try {
    // 初始化向量存储
    const vectorStore = await initVectorStore(userId);

    // 检索相关文档
    const relevantDocs = await vectorStore.similaritySearch(query, 3);

    // 构建上下文
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");

    // 构建系统提示
    const systemPrompt = `请根据以下上下文回答用户问题：\n\n上下文：${context}\n\n`;

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

    // 调用API路由
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get chat response: ${response.statusText}`);
    }

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
    console.error("Error running RAG query stream:", error);
    onError(error as Error);
  }
};

// 清除向量存储缓存
export const clearVectorStoreCache = (userId: string): void => {
  vectorStoreCache.delete(userId);
};
