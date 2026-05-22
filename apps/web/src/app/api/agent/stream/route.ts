import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import {
  DASHSCOPE_BASE_URL,
  getActualModelId,
} from "@notion/ai/config";
import {
  getOrCreateVectorStore,
} from "@notion/ai/server";
import { extractTextFromDocument } from "@notion/ai/utils";

type AgentStreamEvent =
  | { type: "text-delta"; id: string; delta: string }
  | { type: "reasoning-delta"; id: string; delta: string }
  | { type: "tool-call-start"; toolCallId: string; toolName: string }
  | { type: "tool-call-delta"; toolCallId: string; delta: string }
  | { type: "tool-call-result"; toolCallId: string; result: unknown }
  | { type: "finish"; model: string; usage: null }
  | { type: "error"; message: string };

type AgentRequestBody = {
  messages?: OpenAI.ChatCompletionMessageParam[];
  modelId?: string;
  mode?: "auto" | "chat" | "rag";
  enableThinking?: boolean;
  conversationId?: string;
  currentDocument?: CurrentDocumentContext | null;
};

type CurrentDocumentContext = {
  id: string;
  title: string;
  content?: string | null;
};

type PendingToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }
  return new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
}

function createThinkingBody(enableThinking: boolean): Record<string, unknown> | undefined {
  if (!enableThinking) return undefined;
  return {
    enable_thinking: true,
    thinking_budget: 50,
  };
}

function extractLastUserText(messages: OpenAI.ChatCompletionMessageParam[]): string {
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const content = lastUserMessage?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if ("text" in part && typeof part.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function buildSystemMessage(
  hasToolContext: boolean,
): OpenAI.ChatCompletionSystemMessageParam {
  return {
    role: "system",
    content: [
      "You are the Notion AI assistant inside a personal workspace.",
      "Use the same language as the user's latest message unless the user asks otherwise.",
      hasToolContext
        ? "Tool results are provided as context. Answer based on that evidence first. If the evidence is empty or insufficient, say so clearly."
        : "Answer directly and concisely. If the user asks for private workspace knowledge and no tool context is provided, explain what information is missing.",
    ].join("\n"),
  };
}

function shouldUseKnowledgeSearch(query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  const knowledgeSignals = [
    "知识库",
    "文档",
    "笔记",
    "页面",
    "资料",
    "根据",
    "查找",
    "搜索",
    "总结",
    "之前",
    "项目",
    "notion",
    "knowledge",
    "document",
    "docs",
    "note",
    "page",
    "according to",
    "based on",
    "summarize",
    "search",
  ];

  return knowledgeSignals.some((signal) => normalizedQuery.includes(signal));
}

function shouldReadCurrentDocument(
  query: string,
  currentDocument?: CurrentDocumentContext | null,
): boolean {
  if (!currentDocument?.id) return false;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return false;

  const documentSignals = [
    "当前页面",
    "此页面",
    "这个页面",
    "当前文档",
    "此文档",
    "这篇文档",
    "这篇笔记",
    "总结",
    "翻译",
    "深度分析",
    "深度剖析",
    "任务跟踪器",
    "current page",
    "this page",
    "current document",
    "this document",
    "summarize",
    "translate",
    "analyze",
    "task tracker",
  ];

  return documentSignals.some((signal) => normalizedQuery.includes(signal));
}

function enqueueEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: AgentStreamEvent,
): void {
  controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
}

async function executeKnowledgeSearch(
  userId: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const query = typeof args.query === "string" ? args.query : "";
  if (!query.trim()) {
    return { query, documents: [], error: "query is required" };
  }

  const topK = typeof args.topK === "number" ? Math.min(Math.max(args.topK, 1), 8) : 3;
  try {
    const vectorStore = await getOrCreateVectorStore(userId);
    const results = await vectorStore.similaritySearch(query, topK, 0.6);

    return {
      query,
      documents: results.map((result) => ({
        documentId: result.document.metadata?.documentId ?? "",
        title: result.document.metadata?.title ?? "",
        score: Number(result.score.toFixed(4)),
        content: result.document.pageContent,
      })),
    };
  } catch (error) {
    return {
      query,
      documents: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function executeDocumentRead(currentDocument?: CurrentDocumentContext | null): unknown {
  if (!currentDocument?.id) {
    return { document: null, error: "current document is not available" };
  }

  let text = "";
  if (currentDocument.content) {
    try {
      text = extractTextFromDocument(currentDocument.content);
    } catch {
      text = currentDocument.content;
    }
  }

  return {
    document: {
      id: currentDocument.id,
      title: currentDocument.title || "Untitled",
      content: text || "",
    },
  };
}

async function streamModelResponse(
  openai: OpenAI,
  params: OpenAI.ChatCompletionCreateParamsStreaming,
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  responseId: string,
  enableThinking: boolean,
): Promise<PendingToolCall[]> {
  const pendingToolCalls: Record<number, PendingToolCall> = {};
  const startedToolCallIds = new Set<string>();
  const response = await openai.chat.completions.create(params);

  for await (const chunk of response) {
    const delta = chunk.choices[0]?.delta;
    if (!delta) continue;

    const reasoning = enableThinking
      ? (delta as Record<string, unknown>).reasoning_content as string | undefined
      : undefined;
    if (reasoning) {
      enqueueEvent(controller, encoder, {
        type: "reasoning-delta",
        id: responseId,
        delta: reasoning,
      });
    }

    if (delta.content) {
      enqueueEvent(controller, encoder, {
        type: "text-delta",
        id: responseId,
        delta: delta.content,
      });
    }

    for (const toolCallDelta of delta.tool_calls ?? []) {
      const index = toolCallDelta.index ?? 0;
      const existing = pendingToolCalls[index] ?? {
        id: toolCallDelta.id ?? `tool-${index}`,
        type: "function" as const,
        function: { name: "", arguments: "" },
      };

      if (toolCallDelta.id) existing.id = toolCallDelta.id;
      if (toolCallDelta.function?.name) existing.function.name = toolCallDelta.function.name;
      if (toolCallDelta.function?.arguments) {
        existing.function.arguments += toolCallDelta.function.arguments;
      }
      pendingToolCalls[index] = existing;

      if (existing.function.name && !startedToolCallIds.has(existing.id)) {
        startedToolCallIds.add(existing.id);
        enqueueEvent(controller, encoder, {
          type: "tool-call-start",
          toolCallId: existing.id,
          toolName: existing.function.name,
        });
      }

      if (toolCallDelta.function?.arguments) {
        enqueueEvent(controller, encoder, {
          type: "tool-call-delta",
          toolCallId: existing.id,
          delta: toolCallDelta.function.arguments,
        });
      }
    }
  }

  return Object.values(pendingToolCalls);
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as AgentRequestBody;
    const messages = body.messages;
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: "messages must be an array" },
        { status: 400 },
      );
    }

    const model = getActualModelId(body.modelId || "deepseek-v4-pro");
    const mode = body.mode === "rag" || body.mode === "chat" ? body.mode : "auto";
    const userQuery = extractLastUserText(messages);
    const shouldReadDocument = mode === "auto" && shouldReadCurrentDocument(userQuery, body.currentDocument);
    const shouldSearch = mode === "rag" || (mode === "auto" && !shouldReadDocument && shouldUseKnowledgeSearch(userQuery));
    const enableThinking = Boolean(body.enableThinking);
    const openai = getOpenAIClient();
    const encoder = new TextEncoder();
    const responseId = `assistant-${Date.now()}`;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          const baseMessages: OpenAI.ChatCompletionMessageParam[] = [
            buildSystemMessage(shouldReadDocument || shouldSearch),
            ...messages,
          ];
          const extraBody = createThinkingBody(enableThinking);

          if (shouldReadDocument || shouldSearch) {
            const toolCall: PendingToolCall = shouldReadDocument
              ? {
                id: `document-read-${Date.now()}`,
                type: "function",
                function: {
                  name: "document_read",
                  arguments: JSON.stringify({ documentId: body.currentDocument?.id }),
                },
              }
              : {
                id: `knowledge-search-${Date.now()}`,
                type: "function",
                function: {
                  name: "knowledge_search",
                  arguments: JSON.stringify({ query: userQuery, topK: 3 }),
                },
              };
            const toolMessages: OpenAI.ChatCompletionMessageParam[] = [];
            const parsedArgs = JSON.parse(toolCall.function.arguments);

            // Agent auto 直接执行 tool，避免 DashScope thinking mode 与 tool_choice 的兼容限制。
            enqueueEvent(controller, encoder, {
              type: "tool-call-start",
              toolCallId: toolCall.id,
              toolName: toolCall.function.name,
            });
            const result = shouldReadDocument
              ? executeDocumentRead(body.currentDocument)
              : await executeKnowledgeSearch(userId, parsedArgs);
            enqueueEvent(controller, encoder, {
              type: "tool-call-result",
              toolCallId: toolCall.id,
              result,
            });
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });

            const secondTurnParams: OpenAI.ChatCompletionCreateParamsStreaming = {
              model,
              messages: [
                ...baseMessages,
                {
                  role: "assistant",
                  content: null,
                  tool_calls: [toolCall],
                },
                ...toolMessages,
              ],
              stream: true,
            };
            if (extraBody) {
              (secondTurnParams as unknown as Record<string, unknown>).extra_body = extraBody;
            }

            await streamModelResponse(
              openai,
              secondTurnParams,
              controller,
              encoder,
              responseId,
              enableThinking,
            );
          } else {
            const chatParams: OpenAI.ChatCompletionCreateParamsStreaming = {
              model,
              messages: baseMessages,
              stream: true,
            };
            if (extraBody) {
              (chatParams as unknown as Record<string, unknown>).extra_body = extraBody;
            }
            await streamModelResponse(
              openai,
              chatParams,
              controller,
              encoder,
              responseId,
              enableThinking,
            );
          }
          enqueueEvent(controller, encoder, { type: "finish", model, usage: null });
        } catch (error) {
          enqueueEvent(controller, encoder, {
            type: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("[Agent Stream] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
