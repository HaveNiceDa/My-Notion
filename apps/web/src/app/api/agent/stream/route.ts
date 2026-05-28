import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import OpenAI from "openai";
import { DASHSCOPE_BASE_URL, getActualModelId } from "@notion/ai/config";
import { retrieveRelevantMemories } from "@notion/ai/server";
import { api } from "@/convex/_generated/api";
import { buildAvailableTools } from "@/src/lib/agent/tools/registry";
import type { CurrentDocumentContext } from "@/src/lib/agent/tools/types";
import { runReActLoop } from "@/src/lib/agent/react-loop";
import { enqueueEvent } from "@/src/lib/agent/stream";
import { compressContext } from "@/src/lib/agent/context-compression";
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";
import { AgentTracer, getErrorMessage } from "@/src/lib/agent/trace";

type AgentRequestBody = {
  messages?: OpenAI.ChatCompletionMessageParam[];
  modelId?: string;
  enableThinking?: boolean;
  conversationId?: string;
  currentDocument?: CurrentDocumentContext | null;
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY is not configured");
  }
  return new OpenAI({ apiKey, baseURL: DASHSCOPE_BASE_URL });
}

async function getAuthenticatedConvexClient(
  getToken: (options?: { template?: string }) => Promise<string | null>,
) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return null;
  }

  const convexAuthToken = await getToken({ template: "convex" });
  if (!convexAuthToken) {
    return null;
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(convexAuthToken);
  return convex;
}

function buildSystemMessage(
  hasToolContext: boolean,
  memoryContext?: string,
): OpenAI.ChatCompletionSystemMessageParam {
  return {
    role: "system",
    content: [
      "You are the Notion AI assistant inside a personal workspace.",
      "Use the same language as the user's latest message unless the user asks otherwise.",
      hasToolContext
        ? "When the user's question requires information from multiple sources, call multiple tools in the same response instead of making separate calls. For example, if the user asks about both their notes and current events, call knowledge_search and web_search together."
        : "Answer directly and concisely. If the user asks for private workspace knowledge and no tool context is provided, explain what information is missing.",
      "Keep your answers concise and well-structured. Avoid overly long responses.",
      memoryContext
        ? `Relevant long-term memories for this user:\n${memoryContext}\nUse these memories as soft context. The current user instruction always has higher priority.`
        : "",
    ].join("\n"),
  };
}

function extractLatestUserText(messages: OpenAI.ChatCompletionMessageParam[]): string {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const content = latestUserMessage?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

async function buildMemoryContext(options: {
  convex: ConvexHttpClient | null;
  userId: string;
  query: string;
}): Promise<string | undefined> {
  if (!options.convex || !options.query.trim()) return undefined;

  try {
    const memories = await options.convex.query(api.agentMemories.listAgentMemories, {
      limit: 100,
    });
    const result = await retrieveRelevantMemories({
      userId: options.userId,
      query: options.query,
      memories,
      topK: 6,
    });
    if (result.memories.length === 0) return undefined;

    return result.memories
      .map((memory, index) =>
        `${index + 1}. [${memory.type}] ${memory.content}${memory.reason ? ` (reason: ${memory.reason})` : ""}`,
      )
      .join("\n");
  } catch (error) {
    console.warn("[Agent Memory] Failed to build memory context:", error);
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(userId);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitResult.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": String(rateLimitResult.reset),
            "Retry-After": String(Math.ceil((rateLimitResult.reset - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = (await req.json()) as AgentRequestBody;
    const messages = body.messages;
    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { success: false, error: "messages must be an array" },
        { status: 400 },
      );
    }

    const model = getActualModelId(body.modelId || "deepseek-v4-pro");
    const enableThinking = Boolean(body.enableThinking);
    const tracer = new AgentTracer({
      baseMetadata: {
        route: "/api/agent/stream",
        conversationId: body.conversationId,
        model,
        enableThinking,
      },
    });
    const openai = getOpenAIClient();
    const convex = await getAuthenticatedConvexClient(getToken);
    const latestUserText = extractLatestUserText(messages);
    const memoryContext = await buildMemoryContext({ convex, userId, query: latestUserText });
    const encoder = new TextEncoder();
    const responseId = `assistant-${Date.now()}`;

    // 构建可用 tool 列表和映射
    const availableTools = buildAvailableTools(body.currentDocument);
    const toolMap = new Map(availableTools.map((t) => [t.name, t]));
    const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    tracer.mark("run_start", {
      inputMessageCount: messages.length,
      hasCurrentDocument: Boolean(body.currentDocument?.id),
      memoryInjected: Boolean(memoryContext),
      toolNames: availableTools.map((tool) => tool.name),
    });

    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      buildSystemMessage(availableTools.length > 0, memoryContext),
      ...messages,
    ];

    // 长对话上下文压缩：token 超阈值时摘要旧消息 + 保留最近 N 轮
    const compressedMessages = await compressContext(openai, model, allMessages);
    const runStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await runReActLoop({
            openai,
            model,
            messages: compressedMessages,
            tools: openaiTools,
            toolMap,
            toolContext: { userId, model, currentDocument: body.currentDocument, convex: convex ?? undefined },
            enableThinking,
            controller,
            encoder,
            responseId,
            trace: tracer,
          });
          enqueueEvent(controller, encoder, { type: "finish", model, usage: null });
          tracer.event("run_end", elapsedSince(runStartedAt), {
            compressedMessageCount: compressedMessages.length,
          });
        } catch (error) {
          tracer.event("run_error", elapsedSince(runStartedAt), {
            error: getErrorMessage(error),
            compressedMessageCount: compressedMessages.length,
          });
          enqueueEvent(controller, encoder, {
            type: "error",
            message: getErrorMessage(error),
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

function elapsedSince(startedAt: number): number {
  const current = typeof performance !== "undefined" ? performance.now() : Date.now();
  return Math.round(current - startedAt);
}
