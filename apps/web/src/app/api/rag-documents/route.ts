import { NextRequest, NextResponse } from "next/server";
import { updateDocument, deleteDocumentChunks, initKnowledgeBase } from "@notion/ai/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...params } = body;

    switch (action) {
      case "triggerDocumentUpdate": {
        await updateDocument({
          userId: params.userId,
          documentId: params.documentId,
          content: params.content,
          title: params.title,
        });
        return NextResponse.json({ success: true });
      }
      case "removeDocumentFromKnowledgeBase": {
        await deleteDocumentChunks({
          userId: params.userId,
          documentId: params.documentId,
        });
        return NextResponse.json({ success: true });
      }
      case "initKnowledgeBase":
      case "initKnowledgeBaseVectorStore": {
        await initKnowledgeBase(params.userId);
        return NextResponse.json({ success: true });
      }
      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG Documents API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
