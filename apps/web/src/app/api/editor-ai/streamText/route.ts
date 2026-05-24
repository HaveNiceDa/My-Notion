import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import {
  createUIMessageStreamResponse,
  createUIMessageStream,
} from "ai";
import { DASHSCOPE_BASE_URL, getActualModelId, DEFAULT_MODEL } from "@notion/ai/config";
import type { AIModel } from "@notion/ai/config";
import {
  injectDocumentStateMessages,
  convertToOpenAIMessages,
  toolDefinitionsToOpenAITools,
} from "@notion/ai/server/editor-ai";
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";

const EDITOR_AI_SYSTEM_PROMPT = `You're manipulating a text document using HTML blocks.
Make sure to follow the json schema provided. When referencing ids they MUST be EXACTLY the same (including the trailing $).
List items are 1 block with 1 list item each, so block content \`<ul><li>item1</li></ul>\` is valid, but \`<ul><li>item1</li><li>item2</li></ul>\` is invalid. We'll merge them automatically.
For code blocks, you can use the \`data-language\` attribute on a <code> block (wrapped with <pre>) to specify the language.

If the user requests updates to the document, use the "applyDocumentOperations" tool to update the document.
---
IF there is no selection active in the latest state, first, determine what part of the document the user is talking about. You SHOULD probably take cursor info into account if needed.
  EXAMPLE: if user says "below" (without pointing to a specific part of the document) he / she probably indicates the block(s) after the cursor.
  EXAMPLE: If you want to insert content AT the cursor position (UNLESS indicated otherwise by the user), then you need \`referenceId\` to point to the block before the cursor with position \`after\` (or block below and \`before\`)
---
 `;

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

  const resolvedModelId = (modelId || DEFAULT_MODEL) as AIModel;

  const openai = new OpenAI({
    apiKey,
    baseURL: DASHSCOPE_BASE_URL,
  });

  const injectedMessages = injectDocumentStateMessages(messages);
  const openaiMessages = convertToOpenAIMessages(injectedMessages);
  const tools = toolDefinitionsToOpenAITools(toolDefinitions);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const response = await openai.chat.completions.create({
        model: getActualModelId(resolvedModelId),
        messages: [
          { role: "system", content: EDITOR_AI_SYSTEM_PROMPT },
          ...openaiMessages,
        ],
        tools: tools.length > 0 ? tools : undefined,
        stream: true,
      });

      const toolCallState = new Map<
        number,
        { id: string; name: string; args: string }
      >();
      let textId: string | null = null;

      for await (const chunk of response) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          if (!textId) {
            textId = `txt_${Date.now()}`;
            writer.write({ type: "text-start", id: textId });
          }
          writer.write({
            type: "text-delta",
            id: textId,
            delta: delta.content,
          });
        }

        if (delta.tool_calls) {
          for (const toolCall of delta.tool_calls) {
            const idx = toolCall.index ?? 0;

            if (toolCall.id) {
              if (textId) {
                writer.write({ type: "text-end", id: textId });
                textId = null;
              }

              toolCallState.set(idx, {
                id: toolCall.id,
                name: toolCall.function?.name || "",
                args: "",
              });

              writer.write({
                type: "tool-input-start",
                toolCallId: toolCall.id,
                toolName: toolCall.function?.name || "",
              });
            }

            if (toolCall.function?.arguments) {
              const state = toolCallState.get(idx);
              if (state) {
                state.args += toolCall.function.arguments;
                writer.write({
                  type: "tool-input-delta",
                  toolCallId: state.id,
                  inputTextDelta: toolCall.function.arguments,
                });
              }
            }
          }
        }
      }

      if (textId) {
        writer.write({ type: "text-end", id: textId });
      }

      for (const [, state] of toolCallState) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(state.args || "{}");
        } catch {
          parsedInput = { raw: state.args };
        }
        writer.write({
          type: "tool-input-available",
          toolCallId: state.id,
          toolName: state.name,
          input: parsedInput,
        });
      }
    },
    onError: (error) => {
      console.error("[Editor AI] Stream error:", error);
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
