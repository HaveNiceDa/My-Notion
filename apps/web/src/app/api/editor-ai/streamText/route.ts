import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import {
  createUIMessageStreamResponse,
  createUIMessageStream,
} from "ai";
import { DASHSCOPE_BASE_URL } from "@notion/ai/config";
import { getActualModelId } from "@notion/ai/config";
import type { AIModel } from "@notion/ai/config";

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

type ToolDefinition = {
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
};

type ToolDefinitions = Record<string, ToolDefinition>;

function injectDocumentStateMessages(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return messages.flatMap((message) => {
    if (
      message.role === "user" &&
      (message.metadata as Record<string, unknown>)?.documentState
    ) {
      const documentState = (message.metadata as Record<string, unknown>)
        .documentState as {
        selection: boolean;
        selectedBlocks?: unknown[];
        blocks: unknown[];
        isEmptyDocument: boolean;
      };

      const stateText = documentState.selection
        ? `This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):\n${JSON.stringify(documentState.selectedBlocks)}\n\nThis is the latest state of the entire document (INCLUDING the selected text), \nyou can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):\n${JSON.stringify(documentState.blocks)}`
        : `There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document). \nThe cursor is BETWEEN two blocks as indicated by cursor: true.\n${documentState.isEmptyDocument ? "Because the document is empty, YOU MUST first update the empty block before adding new blocks." : "Prefer updating existing blocks over removing and adding (but this also depends on the user's question)."}\n${JSON.stringify(documentState.blocks)}`;

      return [
        {
          role: "assistant",
          content: stateText,
        },
        message,
      ];
    }
    return [message];
  });
}

function toolDefinitionsToOpenAITools(toolDefinitions: ToolDefinitions) {
  return Object.entries(toolDefinitions).map(([name, definition]) => ({
    type: "function" as const,
    function: {
      name,
      description: definition.description || "",
      parameters: definition.inputSchema,
    },
  }));
}

function convertToOpenAIMessages(
  messages: Array<Record<string, unknown>>,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  for (const msg of messages) {
    const role = msg.role as string;

    if (role === "user") {
      const parts = msg.parts as
        | Array<{ type: string; text?: string }>
        | undefined;
      if (parts && Array.isArray(parts)) {
        const text = parts
          .filter((p) => p.type === "text" && p.text)
          .map((p) => p.text!)
          .join("\n");
        result.push({ role: "user", content: text });
      } else {
        result.push({
          role: "user",
          content: (msg.content as string) || "",
        });
      }
    } else if (role === "assistant") {
      const toolInvocations = msg.toolInvocations as
        | Array<{
            toolCallId: string;
            toolName: string;
            args: Record<string, unknown>;
            state?: string;
            result?: unknown;
          }>
        | undefined;

      if (toolInvocations && toolInvocations.length > 0) {
        const textContent = extractTextContent(msg);
        result.push({
          role: "assistant",
          content: textContent || null,
          tool_calls: toolInvocations.map((tc) => ({
            id: tc.toolCallId,
            type: "function" as const,
            function: {
              name: tc.toolName,
              arguments:
                typeof tc.args === "string"
                  ? tc.args
                  : JSON.stringify(tc.args),
            },
          })),
        });

        for (const tc of toolInvocations) {
          if (tc.state === "result" && tc.result !== undefined) {
            result.push({
              role: "tool" as const,
              tool_call_id: tc.toolCallId,
              content:
                typeof tc.result === "string"
                  ? tc.result
                  : JSON.stringify(tc.result),
            } as OpenAI.ChatCompletionToolMessageParam);
          }
        }
      } else {
        const textContent = extractTextContent(msg);
        result.push({ role: "assistant", content: textContent || "" });
      }
    }
  }

  return result;
}

function extractTextContent(msg: Record<string, unknown>): string {
  const parts = msg.parts as
    | Array<{ type: string; text?: string }>
    | undefined;
  if (parts && Array.isArray(parts)) {
    return parts
      .filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .join("\n");
  }
  return (msg.content as string) || "";
}

export const maxDuration = 30;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, toolDefinitions } = await req.json();

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
        model: getActualModelId("Model-1" as AIModel),
        messages: [
          { role: "system", content: EDITOR_AI_SYSTEM_PROMPT },
          ...openaiMessages,
        ],
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
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
