import "dotenv/config";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import {
  streamChat,
  streamRAG,
  updateDocument,
  deleteDocumentChunks,
  initKnowledgeBase,
  type AIStreamEvent,
  type ChatMessage,
  type ChatOptions,
  type RAGOptions,
} from "@notion/ai/server";
import { ConvexDataSource } from "./convex-data-source";

const app = new Hono();

app.use("*", cors());

const getDataSource = () => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  return new ConvexDataSource(convexUrl);
};

app.post("/api/chat", async (c) => {
  const body = await c.req.json();
  const { messages, model, enableThinking, thinkingBudget } = body as {
    messages: ChatMessage[];
    model: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "Invalid messages format" }, 400);
  }

  const options: ChatOptions = {
    model,
    enableThinking,
    thinkingBudget,
  };

  return streamSSE(c, async (stream) => {
    await streamChat(messages, options, (event: AIStreamEvent) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });
  });
});

app.post("/api/rag", async (c) => {
  const body = await c.req.json();
  const {
    userId,
    query,
    model,
    conversationHistory,
    minScore,
    knowledgeBaseEnabled,
    conversationId,
    enableThinking,
    thinkingBudget,
  } = body as {
    userId: string;
    query: string;
    model: string;
    conversationHistory: ChatMessage[];
    minScore?: number;
    knowledgeBaseEnabled?: boolean;
    conversationId?: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  if (!userId || !query) {
    return c.json({ error: "userId and query are required" }, 400);
  }

  const dataSource = getDataSource();

  const options: RAGOptions = {
    userId,
    model,
    conversationHistory: conversationHistory || [],
    dataSource,
    minScore,
    knowledgeBaseEnabled,
    conversationId,
    enableThinking,
    thinkingBudget,
  };

  return streamSSE(c, async (stream) => {
    await streamRAG(query, options, (event: AIStreamEvent) => {
      stream.writeSSE({
        event: event.type,
        data: JSON.stringify(event),
      });
    });
  });
});

app.post("/api/rag-documents", async (c) => {
  const body = await c.req.json();
  const { action, ...params } = body as {
    action: string;
    userId: string;
    documentId: string;
    content?: string;
    title?: string;
  };

  try {
    switch (action) {
      case "triggerDocumentUpdate": {
        await updateDocument({
          userId: params.userId,
          documentId: params.documentId,
          content: params.content!,
          title: params.title!,
        });
        return c.json({ success: true });
      }
      case "removeDocumentFromKnowledgeBase": {
        await deleteDocumentChunks({
          userId: params.userId,
          documentId: params.documentId,
        });
        return c.json({ success: true });
      }
      case "initKnowledgeBase": {
        await initKnowledgeBase(params.userId);
        return c.json({ success: true });
      }
      default:
        return c.json({ error: "Invalid action" }, 400);
    }
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get("/health", (c) => c.json({ status: "ok" }));

const port = parseInt(process.env.PORT || "3001");

export default app;

export { port };
