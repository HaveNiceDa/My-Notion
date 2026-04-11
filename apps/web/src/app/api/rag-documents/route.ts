import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { CustomEmbeddings } from "@/src/lib/rag/customEmbeddings";
import { QdrantVectorStoreWrapper } from "@/src/lib/rag/qdrantVectorStore";

// 初始化Convex客户端
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// 初始化知识库向量存储
const initKnowledgeBaseVectorStore = async (
  userId: string,
  skipDocumentCheck: boolean = false,
): Promise<QdrantVectorStoreWrapper> => {
  console.log(
    `[RAG System] ===== 初始化知识库向量存储 - 用户: ${userId} =====`,
  );

  try {
    // 创建QdrantVectorStoreWrapper实例
    console.log(`[RAG System] 创建QdrantVectorStoreWrapper实例...`);
    const vectorStore = new QdrantVectorStoreWrapper(
      userId,
      new CustomEmbeddings(),
    );

    // 确保collection存在
    await vectorStore.ensureCollectionExists();
    console.log(`[RAG System] Qdrant collection 准备就绪`);

    console.log(`[RAG System] ===== 向量存储初始化完成 =====`);
    return vectorStore;
  } catch (error) {
    console.error("[RAG System] 初始化向量存储时出错:", error);
    throw error;
  }
};

// 处理POST请求
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[RAG Documents API] 接收到请求: ${action}`);

    switch (action) {
      case "triggerDocumentUpdate":
        const {
          userId,
          documentId,
          content,
          title,
        } = params;

        console.log(
          `[RAG System] 触发文档异步更新: documentId=${documentId}, title=${title}`,
        );

        try {
          const vectorStore = await initKnowledgeBaseVectorStore(userId, true);
          await vectorStore.updateDocument(userId, documentId, content, title);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error("[RAG System] 异步更新文档时出错:", error);
          return NextResponse.json({ success: false, error: (error as Error).message });
        }

      case "removeDocumentFromKnowledgeBase":
        const {
          userId: removeUserId,
          documentId: removeDocId,
        } = params;

        console.log(`[RAG System] 从知识库中移除文档: ${removeDocId}`);

        try {
          // 初始化向量存储
          const vectorStore = await initKnowledgeBaseVectorStore(removeUserId, true);
          // 使用 QdrantVectorStoreWrapper 的方法删除文档 chunks
          await vectorStore.deleteDocumentChunks(removeDocId);
          console.log(`[RAG System] 已从Qdrant中删除文档 ${removeDocId} 的chunks`);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error(`[RAG System] 删除文档 ${removeDocId} 的chunks时出错:`, error);
          return NextResponse.json({ success: false, error: (error as Error).message });
        }

      case "initKnowledgeBaseVectorStore":
        const {
          userId: initUserId,
        } = params;

        try {
          await initKnowledgeBaseVectorStore(initUserId);
          return NextResponse.json({ success: true });
        } catch (error) {
          console.error("[RAG System] 初始化知识库向量存储时出错:", error);
          return NextResponse.json({ success: false, error: (error as Error).message });
        }

      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG Documents API error:", error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
