import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { cors } from "hono/cors";
import OpenAI from "openai";

export const runtime = "edge";
export const preferredRegion = "hkg1";

const DASHSCOPE_BASE_URL =
  process.env.DASHSCOPE_BASE_URL ||
  "https://dashscope.aliyuncs.com/compatible-mode/v1";

const CHAT_FIRST_EVENT_TIMEOUT_MS = 20_000;

const app = new Hono().basePath("/api");
app.use("*", cors());

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) throw new Error("LLM_API_KEY is not configured");
  return new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
}

app.post("/chat", async (c) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const body = await c.req.json();
  const { messages, model, enableThinking, thinkingBudget } = body as {
    messages: Array<{ role: string; content: string }>;
    model: string;
    enableThinking?: boolean;
    thinkingBudget?: number;
  };

  if (!messages || !Array.isArray(messages)) {
    return c.json({ error: "Invalid messages format" }, 400);
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

  return streamSSE(c, async (stream) => {
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
          stream.writeSSE({
            event: "reasoning",
            data: JSON.stringify({ type: "reasoning", text: reasoningContent }),
          });
        }

        const text = delta?.content;
        if (text) {
          stream.writeSSE({
            event: "content",
            data: JSON.stringify({ type: "content", text }),
          });
        }

        if (delta?.tool_calls) {
          stream.writeSSE({
            event: "tool_call_start",
            data: JSON.stringify({ type: "tool_call_start", tool_calls: delta.tool_calls }),
          });
        }
      }

      clearTimeout(firstEventTimer);

      if (didTimeoutBeforeFirstEvent) {
        console.log(`[edge/chat][${requestId}] first_event_timeout`);
        stream.writeSSE({
          event: "error",
          data: JSON.stringify({
            type: "error",
            message: `AI upstream first event timeout after ${CHAT_FIRST_EVENT_TIMEOUT_MS}ms`,
          }),
        });
      } else {
        console.log(`[edge/chat][${requestId}] stream_completed`, {
          elapsedMs: Date.now() - startedAt,
        });
        stream.writeSSE({
          event: "done",
          data: JSON.stringify({ type: "done" }),
        });
      }
    } catch (error) {
      console.log(`[edge/chat][${requestId}] error`, {
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      stream.writeSSE({
        event: "error",
        data: JSON.stringify({
          type: "error",
          message: error instanceof Error ? error.message : String(error),
        }),
      });
    }
  });
});

export default app;
