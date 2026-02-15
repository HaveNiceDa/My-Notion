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
    console.log("开始提取文本，原始内容长度:", content.length);
    console.log("原始内容预览:", content.substring(0, 200));

    const parsedContent = JSON.parse(content);
    console.log("JSON解析成功，内容类型:", typeof parsedContent);
    console.log(
      "解析后的内容:",
      JSON.stringify(parsedContent).substring(0, 500),
    );

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
    console.log("提取的文本结果长度:", result.length);
    console.log("提取的文本结果:", result);
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
    console.log("使用缓存的向量存储");
    return vectorStoreCache.get(userId)!;
  }

  try {
    console.log("开始初始化向量存储...");
    // 获取用户文档
    console.log("开始获取用户文档...");
    const documents = await convex.query(api.documents.getDocumentsForRAG, {
      userId,
    });
    console.log("获取到的文档数量:", documents.length);
    for (let i = 0; i < documents.length; i++) {
      console.log(
        `文档 ${i + 1}:`,
        documents[i].title,
        "有内容:",
        !!documents[i].content,
      );
    }

    // 处理文档内容
    const texts = [];
    console.log("开始处理文档内容...");
    for (const doc of documents) {
      if (doc.content) {
        console.log("处理文档:", doc.title);
        const text = extractTextFromDocument(doc.content);
        console.log("提取的文本长度:", text.length);
        if (text) {
          texts.push({
            pageContent: text,
            metadata: { documentId: doc._id, title: doc.title },
          });
          console.log(
            "添加到texts的文档:",
            doc.title,
            "文本长度:",
            text.length,
          );
        } else {
          console.log("提取的文本为空，跳过文档:", doc.title);
        }
      } else {
        console.log("文档无内容，跳过:", doc.title);
      }
    }
    console.log("最终texts数组长度:", texts.length);

    // 分割文本
    const allSplits = [];
    console.log("开始分割文本...");
    for (const item of texts) {
      console.log(
        "分割文档:",
        item.metadata.title,
        "原始文本长度:",
        item.pageContent.length,
      );
      const splits = await textSplitter.splitText(item.pageContent);
      console.log("分割后的片段数量:", splits.length);
      for (const split of splits) {
        allSplits.push({
          pageContent: split,
          metadata: item.metadata,
        });
      }
    }
    console.log("分割后的allSplits长度:", allSplits.length);

    // 创建向量存储（使用简单内存存储，无需额外服务器）
    console.log("创建向量存储...");
    const vectorStore = new SimpleVectorStore(new CustomEmbeddings());
    console.log("开始添加文档到向量存储...");
    await vectorStore.addDocuments(allSplits);
    console.log("向量存储创建完成，添加了", allSplits.length, "个文档片段");

    // 缓存向量存储
    vectorStoreCache.set(userId, vectorStore);
    console.log("向量存储已缓存");

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
    console.log("检索到的相关文档数量:", relevantDocs.length);
    for (let i = 0; i < relevantDocs.length; i++) {
      console.log(
        `文档 ${i + 1} 内容长度:`,
        relevantDocs[i].pageContent.length,
      );
      console.log(
        `文档 ${i + 1} 内容预览:`,
        relevantDocs[i].pageContent.substring(0, 100) + "...",
      );
    }

    // 构建上下文
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    console.log("构建的上下文长度:", context.length);
    console.log("构建的上下文内容:", context);

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
  onChunk: (chunk: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
): Promise<void> => {
  try {
    // 初始化向量存储
    const vectorStore = await initVectorStore(userId);

    // 检索相关文档
    const relevantDocs = await vectorStore.similaritySearch(query, 3);
    console.log("流式查询 - 检索到的相关文档数量:", relevantDocs.length);
    for (let i = 0; i < relevantDocs.length; i++) {
      console.log(
        `流式查询 - 文档 ${i + 1} 内容长度:`,
        relevantDocs[i].pageContent.length,
      );
      console.log(
        `流式查询 - 文档 ${i + 1} 内容预览:`,
        relevantDocs[i].pageContent.substring(0, 100) + "...",
      );
    }

    // 构建上下文
    const context = relevantDocs.map((doc) => doc.pageContent).join("\n\n");
    console.log("流式查询 - 构建的上下文长度:", context.length);
    console.log("流式查询 - 构建的上下文内容:", context);

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
