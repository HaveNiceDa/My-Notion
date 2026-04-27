import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { QdrantVectorStoreWrapper } from "@notion/ai/rag";
import { CustomEmbeddings } from "@notion/ai/embeddings";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, ...params } = body;

    const vectorStore = new QdrantVectorStoreWrapper(
      userId,
      new CustomEmbeddings(),
    );

    switch (action) {
      case "ensureCollectionExists":
        await vectorStore.ensureCollectionExists();
        return NextResponse.json({ success: true });

      case "addDocumentChunks": {
        const { documentId, chunks } = params;
        const result = await vectorStore.addDocumentChunks(
          userId,
          documentId,
          chunks,
        );
        return NextResponse.json({ success: true, result });
      }

      case "deleteDocumentChunks": {
        const { documentId: deleteDocId } = params;
        await vectorStore.deleteDocumentChunks(deleteDocId);
        return NextResponse.json({ success: true });
      }

      case "getDocumentsCount": {
        const count = await vectorStore.getDocumentsCount();
        return NextResponse.json({ success: true, count });
      }

      case "needsReembedding": {
        const { documentId: reembedDocId, content } = params;
        const needsReembed = await vectorStore.needsReembedding(
          reembedDocId,
          content,
        );
        return NextResponse.json({ success: true, needsReembed });
      }

      case "similaritySearch": {
        const { query, k, minScore, excludeDocumentIds } = params;
        const similarityResults = await vectorStore.similaritySearch(
          query,
          k,
          minScore,
          excludeDocumentIds ? new Set(excludeDocumentIds) : undefined,
        );
        return NextResponse.json({ success: true, results: similarityResults });
      }

      case "hybridSearch": {
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
      }

      case "updateDocument": {
        const { documentId: updateDocId, content: docContent, title } = params;
        await vectorStore.updateDocument(
          userId,
          updateDocId,
          docContent,
          title,
        );
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 },
        );
    }
  } catch (error: any) {
    console.error("Qdrant API error:", error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}
