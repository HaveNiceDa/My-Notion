import OpenAI from "openai";

export const runtime = "edge";
export const preferredRegion = "hkg1";

const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

const CHAT_FIRST_EVENT_TIMEOUT_MS = 20_000;

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not configured");
  return new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
}

function encodeSSE(event: string, data: object): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, model, enableThinking, thinkingBudget } = body as {
    messages: Array<{ role: string; content: string }>;
    model: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Invalid messages format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  console.log(`[edge/chat][${requestId}] request_received`, {
    model,
    messageCount: messages.length,
  });

  const openai = getOpenAIClient();

  const requestParams: OpenAI.ChatCompletionCreateParamsStreaming = {
    model,
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
      "Access-Control-Allow-Origin": "*",
    },
  });
}
