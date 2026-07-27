import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import {
  createUIMessageStreamResponse,
  createUIMessageStream,
} from "ai";
import { DASHSCOPE_BASE_URL, DEFAULT_MODEL, resolveAllowedModelId } from "@notion/ai/config";
import { ToolCallAccumulator } from "@notion/ai/utils";
import {
  injectDocumentStateMessages,
  convertToOpenAIMessages,
  toolDefinitionsToOpenAITools,
  buildEditorAIStreamOptions,
} from "@notion/ai/server/editor-ai";
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";

export const runtime = "edge";
export const preferredRegion = "hkg1";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rateLimitResult = await checkRateLimit(`editor-ai:${userId}`);
  if (!rateLimitResult.success) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
        },
      },
    );
  }

  const { messages, toolDefinitions, modelId } = await req.json();

  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Invalid messages format" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "LLM_API_KEY not configured" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  let resolvedModelId: string;
  try {
    resolvedModelId = resolveAllowedModelId(modelId, DEFAULT_MODEL);
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unsupported AI model" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: DASHSCOPE_BASE_URL,
  });

  const injectedMessages = injectDocumentStateMessages(messages);
  const openaiMessages = convertToOpenAIMessages(injectedMessages);
  const tools = toolDefinitionsToOpenAITools(toolDefinitions);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      try {
        const response = await openai.chat.completions.create(
          buildEditorAIStreamOptions({
            model: resolvedModelId,
            messages: openaiMessages,
            tools,
          }),
        );

        const accumulator = new ToolCallAccumulator();

        for await (const chunk of response) {
          const choice = chunk.choices[0];
          if (!choice) continue;
          const delta = choice.delta;

          // tool_choice: "required" 下模型可能仍输出少量前置文本（如"好的"），
          // BlockNote 编辑器模式只期望 tool 事件，文本内容会干扰操作解析，直接丢弃。
          const changes = accumulator.feed(delta);

          for (const change of changes) {
            if (change.idUpdated) {
              writer.write({
                type: "tool-input-start",
                toolCallId: change.call.id,
                toolName: change.call.name || "applyDocumentOperations",
              });
              if (change.argsBeforeId) {
                writer.write({
                  type: "tool-input-delta",
                  toolCallId: change.call.id,
                  inputTextDelta: change.argsBeforeId,
                });
              }
            }
            if (change.argsDelta) {
              writer.write({
                type: "tool-input-delta",
                toolCallId: change.call.id,
                inputTextDelta: change.argsDelta,
              });
            }
          }
        }

        const toolCalls = accumulator.getToolCalls();
        for (const tc of toolCalls) {
          if (!tc.function.arguments) {
            writer.write({
              type: "error",
              errorText: "AI 返回的文档操作为空，请重试。",
            });
            continue;
          }
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(tc.function.arguments);
          } catch {
            writer.write({
              type: "error",
              errorText: "生成的文档操作格式有误，请重试。",
            });
            continue;
          }
          writer.write({
            type: "tool-input-available",
            toolCallId: tc.id,
            toolName: tc.function.name || "applyDocumentOperations",
            input: parsedInput,
          });
        }

        if (toolCalls.length === 0) {
          writer.write({
            type: "error",
            errorText: "AI 未返回文档操作，请重试。",
          });
        }
      } catch (error) {
        console.error("[Editor AI] Stream error:", error);
        writer.write({
          type: "error",
          errorText:
            error instanceof Error ? error.message : "AI 请求失败，请重试。",
        });
      }
    },
    onError: (error) => {
      console.error("[Editor AI] Stream onError:", error);
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
