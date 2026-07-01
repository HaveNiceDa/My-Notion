import "dotenv/config";
import { randomUUID } from "crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import { DEFAULT_MODEL, resolveAllowedModelId } from "../../../packages/ai/config";
import {
  streamChat,
  streamRAG,
  updateDocument,
  deleteDocumentChunks,
  initKnowledgeBase,
} from "../../../packages/ai/server";
import type {
  AIStreamEvent,
  ChatMessage,
  ChatOptions,
  RAGOptions,
} from "../../../packages/ai/server/types";
import { ConvexDataSource } from "./convex-data-source";
import { captureException, startSpan } from "./sentry";

const app = new Hono().basePath("/api");
const CHAT_FIRST_EVENT_TIMEOUT_MS = 20_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

type RequestWindow = { timestamps: number[] };

const rateLimitStore = new Map<string, RequestWindow>();

app.use("*", cors({
  origin: (origin) => {
    const allowedOrigins = parseCsv(process.env.AI_SERVICE_ALLOWED_ORIGINS);
    if (allowedOrigins.length === 0) return "*";
    return allowedOrigins.includes(origin) ? origin : "";
  },
  allowHeaders: ["Authorization", "Content-Type"],
  allowMethods: ["GET", "POST", "OPTIONS"],
}));

app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;
  if (c.req.method === "OPTIONS" || pathname.endsWith("/health")) {
    return next();
  }

  const authorization = authorizeRequest(
    c.req.header("authorization"),
    c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip"),
  );
  if (!authorization.ok) {
    return c.json({ error: authorization.error }, authorization.status);
  }

  const rateLimit = checkRateLimit(authorization.key);
  if (!rateLimit.ok) {
    return c.json(
      { error: "Too many requests" },
      429,
      { "Retry-After": String(rateLimit.retryAfter) },
    );
  }

  await next();
});

function parseCsv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function authorizeRequest(
  authorization: string | undefined,
  rateLimitKey?: string,
): { ok: true; key: string } | { ok: false; status: 401 | 503; error: string } {
  const expectedToken = process.env.AI_SERVICE_AUTH_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      status: 503,
      error: "AI_SERVICE_AUTH_TOKEN is not configured",
    };
  }

  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token || token !== expectedToken) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, key: rateLimitKey || "authenticated" };
}

function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfter: number } {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const window = rateLimitStore.get(key) ?? { timestamps: [] };
  window.timestamps = window.timestamps.filter((timestamp) => timestamp > cutoff);

  if (window.timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((window.timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    rateLimitStore.set(key, window);
    return { ok: false, retryAfter: Math.max(retryAfter, 1) };
  }

  window.timestamps.push(now);
  rateLimitStore.set(key, window);
  return { ok: true };
}

function logChatStage(
  requestId: string,
  stage: string,
  details?: Record<string, unknown>,
): void {
  const payload = details ? ` ${JSON.stringify(details)}` : "";
  console.log(`[services/ai][chat][${requestId}] ${stage}${payload}`);
}

const getDataSource = () => {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not configured");
  return new ConvexDataSource(convexUrl);
};

app.post("/chat", async (c) => {
  const requestId = c.req.header("x-vercel-id") ?? randomUUID();
  const startedAt = Date.now();
  const body = await c.req.json();
  const { messages, model, enableThinking, thinkingBudget } = body as {
    messages: ChatMessage[];
    model: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  if (!messages || !Array.isArray(messages)) {
    logChatStage(requestId, "request_invalid", {
      reason: "messages_not_array",
    });
    return c.json({ error: "Invalid messages format" }, 400);
  }

  let resolvedModel: string;
  try {
    resolvedModel = resolveAllowedModelId(model, DEFAULT_MODEL);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unsupported AI model" },
      400,
    );
  }

  logChatStage(requestId, "request_received", {
    model: resolvedModel,
    messageCount: messages.length,
    enableThinking: Boolean(enableThinking),
    thinkingBudget: thinkingBudget ?? null,
  });

  const options: ChatOptions = {
    model: resolvedModel,
    enableThinking,
    thinkingBudget,
  };

  return streamSSE(c, async (stream) => {
    try {
      await startSpan("ai.chat.stream", async () => {
        logChatStage(requestId, "sse_opened", {
          timeoutMs: CHAT_FIRST_EVENT_TIMEOUT_MS,
        });

        await streamChat(
          messages,
          options,
          (event: AIStreamEvent) => {
            if (event.type === "content") {
              logChatStage(requestId, "sse_event_content", {
                chunkLength: event.text.length,
                elapsedMs: Date.now() - startedAt,
              });
            } else if (event.type === "error") {
              logChatStage(requestId, "sse_event_error", {
                message: event.message,
                elapsedMs: Date.now() - startedAt,
              });
            } else if (event.type === "done") {
              logChatStage(requestId, "sse_event_done", {
                elapsedMs: Date.now() - startedAt,
              });
            }

            stream.writeSSE({
              event: event.type,
              data: JSON.stringify(event),
            });
          },
          {
            firstEventTimeoutMs: CHAT_FIRST_EVENT_TIMEOUT_MS,
            onStage: (stage, details) => {
              logChatStage(requestId, stage, {
                elapsedMs: Date.now() - startedAt,
                ...details,
              });
            },
          },
        );
      });
    } catch (error) {
      captureException(error, { endpoint: "chat", model: resolvedModel });
      logChatStage(requestId, "route_catch_error", {
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      stream.writeSSE({
        event: "error",
        data: JSON.stringify({ type: "error", error: "Stream failed" }),
      });
    }
  });
});

app.post("/rag", async (c) => {
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

  let resolvedModel: string;
  try {
    resolvedModel = resolveAllowedModelId(model, DEFAULT_MODEL);
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : "Unsupported AI model" },
      400,
    );
  }

  const dataSource = getDataSource();

  const options: RAGOptions = {
    userId,
    model: resolvedModel,
    conversationHistory: conversationHistory || [],
    dataSource,
    minScore,
    knowledgeBaseEnabled,
    conversationId,
    enableThinking,
    thinkingBudget,
  };

  return streamSSE(c, async (stream) => {
    try {
      await startSpan("ai.rag.stream", async () => {
        await streamRAG(query, options, (event: AIStreamEvent) => {
          stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        });
      });
    } catch (error) {
      captureException(error, { endpoint: "rag", model: resolvedModel, userId });
      stream.writeSSE({
        event: "error",
        data: JSON.stringify({ type: "error", error: "RAG stream failed" }),
      });
    }
  });
});

app.post("/rag-documents", async (c) => {
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
    captureException(error, { endpoint: "rag-documents", action });
    return c.json({ success: false, error: error.message }, 500);
  }
});

app.get("/health", (c) => c.json({ status: "ok" }));

const port = parseInt(process.env.PORT || "3001");

export default app;

export { port };
