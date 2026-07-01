import OpenAI from "openai";
import { DEFAULT_MODEL, resolveAllowedModelId } from "@notion/ai/config";

export const runtime = "edge";
export const preferredRegion = "hkg1";

const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

const CHAT_FIRST_EVENT_TIMEOUT_MS = 20_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

type RequestWindow = { timestamps: number[] };

const rateLimitStore = new Map<string, RequestWindow>();

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not configured");
  return new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
}

function getCorsHeaders(request: Request): Record<string, string> {
  const allowedOrigins = parseCsv(process.env.AI_SERVICE_ALLOWED_ORIGINS);
  const origin = request.headers.get("origin") || "";
  const allowedOrigin = allowedOrigins.length === 0
    ? "*"
    : allowedOrigins.includes(origin)
      ? origin
      : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

function parseCsv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function jsonResponse(
  request: Request,
  data: object,
  status: number,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function authorizeRequest(request: Request): { ok: true; key: string } | { ok: false; status: number; error: string } {
  const expectedToken = process.env.AI_SERVICE_AUTH_TOKEN;
  if (!expectedToken) {
    return {
      ok: false,
      status: 503,
      error: "AI_SERVICE_AUTH_TOKEN is not configured",
    };
  }

  const token = getBearerToken(request);
  if (!token || token !== expectedToken) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  return { ok: true, key: request.headers.get("x-forwarded-for") || "authenticated" };
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

function encodeSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export async function POST(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  const authorization = authorizeRequest(request);
  if (!authorization.ok) {
    return jsonResponse(request, { error: authorization.error }, authorization.status);
  }

  const rateLimit = checkRateLimit(authorization.key);
  if (!rateLimit.ok) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        ...getCorsHeaders(request),
        "Content-Type": "application/json",
        "Retry-After": String(rateLimit.retryAfter),
      },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(request, { error: "Invalid JSON" }, 400);
  }

  const { messages, model, enableThinking, thinkingBudget } = body as {
    messages: Array<{ role: string; content: string }>;
    model: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  if (!messages || !Array.isArray(messages)) {
    return jsonResponse(request, { error: "Invalid messages format" }, 400);
  }

  let resolvedModel: string;
  try {
    resolvedModel = resolveAllowedModelId(model, DEFAULT_MODEL);
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "Unsupported AI model" },
      400,
    );
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  console.log(`[edge/chat][${requestId}] request_received`, {
    model: resolvedModel,
    messageCount: messages.length,
  });

  const openai = getOpenAIClient();

  const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
    model: resolvedModel,
    messages: messages as OpenAI.ChatCompletionMessageParam[],
    stream: true,
  };

  if (enableThinking) {
    (requestParams as unknown as Record<string, unknown>).extra_body = {
      enable_thinking: true,
      thinking_budget: thinkingBudget ?? 50,
    };
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const abortController = new AbortController();
      let didReceiveFirstEvent = false;
      let didTimeoutBeforeFirstEvent = false;

      const firstEventTimer = setTimeout(() => {
        if (!didReceiveFirstEvent) {
          didTimeoutBeforeFirstEvent = true;
          abortController.abort();
        }
      }, CHAT_FIRST_EVENT_TIMEOUT_MS);

      try {
        console.log(`[edge/chat][${requestId}] model_request_started`);

        const response = await openai.chat.completions.create(
          requestParams,
          { signal: abortController.signal },
        );

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta;

          if (!didReceiveFirstEvent && delta) {
            didReceiveFirstEvent = true;
            clearTimeout(firstEventTimer);
            console.log(`[edge/chat][${requestId}] first_event_received`, {
              elapsedMs: Date.now() - startedAt,
            });
          }

          const reasoningContent = enableThinking
            ? (delta as Record<string, unknown>)?.reasoning_content as string | undefined
            : undefined;
          if (reasoningContent) {
            controller.enqueue(
              encoder.encode(encodeSSE("reasoning", { type: "reasoning", text: reasoningContent })),
            );
          }

          const text = delta?.content;
          if (text) {
            controller.enqueue(
              encoder.encode(encodeSSE("content", { type: "content", text })),
            );
          }

          if (delta?.tool_calls) {
            controller.enqueue(
              encoder.encode(encodeSSE("tool_call_start", { type: "tool_call_start", tool_calls: delta.tool_calls })),
            );
          }
        }

        clearTimeout(firstEventTimer);

        if (didTimeoutBeforeFirstEvent) {
          console.log(`[edge/chat][${requestId}] first_event_timeout`);
          controller.enqueue(
            encoder.encode(encodeSSE("error", {
              type: "error",
              message: `AI upstream first event timeout after ${CHAT_FIRST_EVENT_TIMEOUT_MS}ms`,
            })),
          );
        } else {
          console.log(`[edge/chat][${requestId}] stream_completed`, {
            elapsedMs: Date.now() - startedAt,
          });
          controller.enqueue(
            encoder.encode(encodeSSE("done", { type: "done" })),
          );
        }

        controller.close();
      } catch (error) {
        clearTimeout(firstEventTimer);
        console.log(`[edge/chat][${requestId}] error`, {
          elapsedMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        controller.enqueue(
          encoder.encode(encodeSSE("error", {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          })),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...getCorsHeaders(request),
    },
  });
}
