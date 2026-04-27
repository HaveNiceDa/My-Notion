import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { initKnowledgeBaseVectorStore, runRAGQuery } from "@/src/lib/rag/ragUtils";
import { updateDocument, deleteDocumentChunks, initKnowledgeBase } from "@notion/ai/server";

async function getAuthenticatedConvexClient(): Promise<ConvexHttpClient | null> {
  const { getToken, userId } = await auth();
  if (!userId) return null;
  const token = await getToken({ template: "convex" });
  const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) {
    client.setAuth(token);
  }
  return client;
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
        await updateDocument({
          userId,
          documentId: params.documentId,
          content: params.content,
          title: params.title,
        });
        return NextResponse.json({ success: true });
      }
      case "removeDocumentFromKnowledgeBase": {
        await deleteDocumentChunks({
          userId,
          documentId: params.documentId,
        });
        return NextResponse.json({ success: true });
      }
      case "initKnowledgeBase":
      case "initKnowledgeBaseVectorStore": {
        const convex = await getAuthenticatedConvexClient();
        if (!convex) {
          return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        await initKnowledgeBase(userId);
        await initKnowledgeBaseVectorStore(convex, userId, undefined, true);
        return NextResponse.json({ success: true });
      }
      case "runRAGQuery": {
        const convex = await getAuthenticatedConvexClient();
        if (!convex) {
          return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
        }
        const result = await runRAGQuery(
          convex,
          userId,
          params.query,
          params.model,
          params.minScore,
          params.conversationHistory,
          params.knowledgeBaseEnabled,
          params.conversationId,
        );
        return NextResponse.json({ success: true, answer: result });
      }
      default:
        return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("RAG Documents API error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
