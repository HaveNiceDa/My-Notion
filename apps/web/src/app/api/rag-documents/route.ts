import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { updateDocument, deleteDocumentChunks, initKnowledgeBase } from "@notion/ai/server";

function isQdrantUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("QDRANT_URL") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("connect") ||
    msg.includes("timeout")
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "triggerDocumentUpdate": {
        try {
          await updateDocument({
            userId,
            documentId: params.documentId,
            content: params.content,
            title: params.title,
            updatedAt: params.updatedAt,
            tags: params.tags,
            documentPath: params.documentPath,
          });
        } catch (error) {
          if (isQdrantUnavailable(error)) {
            return NextResponse.json({
              success: true,
              warning: "Vector store unavailable — document not indexed",
            });
          }
          throw error;
        }
        return NextResponse.json({ success: true });
      }
      case "removeDocumentFromKnowledgeBase": {
        try {
          await deleteDocumentChunks({
            userId,
            documentId: params.documentId,
          });
        } catch (error) {
          if (isQdrantUnavailable(error)) {
            return NextResponse.json({
              success: true,
              warning: "Vector store unavailable — document chunks not removed",
            });
          }
          throw error;
        }
        return NextResponse.json({ success: true });
      }
      case "initKnowledgeBase":
      case "initKnowledgeBaseVectorStore": {
        try {
          await initKnowledgeBase(userId);
        } catch (error) {
          if (isQdrantUnavailable(error)) {
            return NextResponse.json({
              success: true,
              warning: "Vector store unavailable — knowledge base features disabled until Qdrant is reachable",
            });
          }
          throw error;
        }
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error("RAG Documents API error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
