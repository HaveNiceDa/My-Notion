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

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  let body: {
    messages: Array<{ role: string; content: string }>;
    model: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, model, enableThinking, thinkingBudget } = body;

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Invalid messages format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const abortController = new AbortController();
        let didReceiveFirstEvent = false;
        let didTimeoutBeforeFirstEvent = false;

        const firstEventTimer = setTimeout(() => {
          if (!didReceiveFirstEvent) {
            didTimeoutBeforeFirstEvent = true;
            abortController.abort();
          }
        }, CHAT_FIRST_EVENT_TIMEOUT_MS);

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
              encoder.encode(
                `event: reasoning\ndata: ${JSON.stringify({ type: "reasoning", text: reasoningContent })}\n\n`,
              ),
            );
          }

          const text = delta?.content;
          if (text) {
            controller.enqueue(
              encoder.encode(
                `event: content\ndata: ${JSON.stringify({ type: "content", text })}\n\n`,
              ),
            );
          }

          if (delta?.tool_calls) {
            controller.enqueue(
              encoder.encode(
                `event: tool_call_start\ndata: ${JSON.stringify({ type: "tool_call_start", tool_calls: delta.tool_calls })}\n\n`,
              ),
            );
          }
        }

        clearTimeout(firstEventTimer);

        if (didTimeoutBeforeFirstEvent) {
          console.log(`[edge/chat][${requestId}] first_event_timeout`);
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ type: "error", message: `AI upstream first event timeout after ${CHAT_FIRST_EVENT_TIMEOUT_MS}ms` })}\n\n`,
            ),
          );
        } else {
          console.log(`[edge/chat][${requestId}] stream_completed`, {
            elapsedMs: Date.now() - startedAt,
          });
          controller.enqueue(
            encoder.encode(
              `event: done\ndata: ${JSON.stringify({ type: "done" })}\n\n`,
            ),
          );
        }

        controller.close();
      } catch (error) {
        console.log(`[edge/chat][${requestId}] error`, {
          elapsedMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : String(error) })}\n\n`,
          ),
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
