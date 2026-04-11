import { NextRequest, NextResponse } from "next/server";
import { QdrantVectorStoreWrapper } from "@notion/ai/rag";
import { CustomEmbeddings } from "@notion/ai/embeddings";

// Qdrant 操作 API 路由
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, ...params } = body;

    console.log(`[Qdrant API] 接收到请求: ${action}, userId: ${userId}`);

    if (action === "addDocumentChunks") {
      const { documentId, chunks } = params;
      console.log(
        `[Qdrant API] addDocumentChunks - documentId: ${documentId}, chunks count: ${chunks?.length}`,
      );
      if (chunks && chunks.length > 0) {
        console.log(
          `[Qdrant API] 第一个 chunk 的向量维度: ${chunks[0].embedding?.length}`,
        );
        console.log(
          `[Qdrant API] 第一个 chunk 的 chunkIndex: ${chunks[0].chunkIndex}`,
        );
        console.log(
          `[Qdrant API] 第一个 chunk 的 pageContent 长度: ${chunks[0].pageContent?.length}`,
        );
      }
    }

    // 创建 QdrantVectorStoreWrapper 实例
    const vectorStore = new QdrantVectorStoreWrapper(
      userId,
      new CustomEmbeddings(),
    );

    switch (action) {
      case "ensureCollectionExists":
        await vectorStore.ensureCollectionExists();
        return NextResponse.json({ success: true });

      case "addDocumentChunks":
        const { documentId, chunks } = params;
        const result = await vectorStore.addDocumentChunks(
          userId,
          documentId,
          chunks,
        );
        return NextResponse.json({ success: true, result });

      case "deleteDocumentChunks":
        const { documentId: deleteDocId } = params;
        await vectorStore.deleteDocumentChunks(deleteDocId);
        return NextResponse.json({ success: true });

      case "getDocumentsCount":
        const count = await vectorStore.getDocumentsCount();
        return NextResponse.json({ success: true, count });

      case "needsReembedding":
        const { documentId: reembedDocId, content } = params;
        const needsReembed = await vectorStore.needsReembedding(
          reembedDocId,
          content,
        );
        return NextResponse.json({ success: true, needsReembed });

      case "similaritySearch":
        const { query, k, minScore, excludeDocumentIds } = params;
        const similarityResults = await vectorStore.similaritySearch(
          query,
          k,
          minScore,
          excludeDocumentIds ? new Set(excludeDocumentIds) : undefined,
        );
        return NextResponse.json({ success: true, results: similarityResults });

      case "hybridSearch":
        const {
          query: hybridQuery,
          k: hybridK,
          minScore: hybridMinScore,
          excludeDocumentIds: hybridExcludeIds,
        } = params;
        const hybridResults = await vectorStore.hybridSearch(
          hybridQuery,
          hybridK,
          hybridMinScore,
          hybridExcludeIds ? new Set(hybridExcludeIds) : undefined,
        );
        return NextResponse.json({ success: true, results: hybridResults });

      case "updateDocument":
        const { documentId: updateDocId, content: docContent, title } = params;
        await vectorStore.updateDocument(
          userId,
          updateDocId,
          docContent,
          title,
        );
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error: any) {
    console.error("Qdrant API error:", error);
    console.error(
      "Qdrant API error details:",
      error.response?.data || error.data || error.message,
    );
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
