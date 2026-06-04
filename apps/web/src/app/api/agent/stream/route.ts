import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import OpenAI from "openai";
import { DASHSCOPE_BASE_URL, getActualModelId } from "@notion/ai/config";
import { api } from "@/convex/_generated/api";
import { buildAvailableTools } from "@/src/lib/agent/tools/registry";
import type { CurrentDocumentContext } from "@/src/lib/agent/tools/types";
import { runReActLoop } from "@/src/lib/agent/react-loop";
import { enqueueEvent } from "@/src/lib/agent/stream";
import { compressContext } from "@/src/lib/agent/context-compression";
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";
import { AgentTracer, getErrorMessage } from "@/src/lib/agent/trace";
import {
  extractMemoryCandidates,
  proposeExtractedMemories,
} from "@/src/lib/agent/memory-extractor";
import type { MemoryExtractionMessage } from "@/src/lib/agent/memory-extractor";

type AgentRequestBody = {
  messages?: OpenAI.ChatCompletionMessageParam[];
  modelId?: string;
  enableThinking?: boolean;
  conversationId?: string;
  currentDocument?: CurrentDocumentContext | null;
  mode?: "chat" | "plan";
  autoExtractMemories?: boolean;
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
  instructionMemoryContext?: string,
  mode: "chat" | "plan" = "chat",
): OpenAI.ChatCompletionSystemMessageParam {
  const planModeInstruction = mode === "plan"
    ? [
      "The user is asking for a plan. You must call the task_plan tool exactly once before the final answer.",
      "Do not execute the plan yet. Do not call write tools, memory write, or any irreversible operation in plan mode.",
      "Make the plan concrete and ordered. Each step should be independently executable and have a clear title.",
      "After calling task_plan, ask the user to review and confirm the plan before execution.",
    ].join("\n")
    : "";

  return {
    role: "system",
    content: [
      "You are the Notion AI assistant inside a personal workspace.",
      "Use the same language as the user's latest message unless the user asks otherwise.",
      hasToolContext
        ? "When the user's question requires information from multiple sources, call multiple tools in the same response instead of making separate calls. For example, if the user asks about both their notes and current events, call knowledge_search and web_search together."
        : "Answer directly and concisely. If the user asks for private workspace knowledge and no tool context is provided, explain what information is missing.",
      "Keep your answers concise and well-structured. Avoid overly long responses.",
      planModeInstruction,
      instructionMemoryContext
        ? `User-confirmed preferences and project rules:\n${instructionMemoryContext}\nTreat these as compact soft rules. The current user instruction and explicit system safety constraints still have higher priority. Use memory_search when you need more confirmed preferences, project rules, or recent decisions.`
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

interface InstructionMemoryContext {
  text?: string;
  injectedMemoryIds: string[];
}

async function buildInstructionMemoryContext(options: {
  convex: ConvexHttpClient | null;
  userId: string;
}): Promise<InstructionMemoryContext> {
  if (!options.convex) return { injectedMemoryIds: [] };

  try {
    const memories = await options.convex.query(api.agentMemories.listAgentMemories, {
      limit: 100,
    });
    const instructionMemories = memories
      .filter((memory) =>
        memory.kind === "instruction"
        && memory.status === "active"
        && memory.privacy !== "sensitive"
        && memory.scopeLevel === "user"
        && memory.scopeKey === options.userId,
      )
      .sort((a, b) => {
        const importanceDelta = (b.importance ?? 0.5) - (a.importance ?? 0.5);
        if (importanceDelta !== 0) return importanceDelta;
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      })
      .slice(0, 6);
    if (instructionMemories.length === 0) return { injectedMemoryIds: [] };

    const lines: string[] = [];
    let usedChars = 0;
    for (const memory of instructionMemories) {
      const line = `- [${memory.category ?? memory.type}] ${memory.summary || memory.content}`;
      if (usedChars + line.length > 1_200) break;
      lines.push(line);
      usedChars += line.length;
    }

    return {
      text: lines.join("\n"),
      injectedMemoryIds: instructionMemories.map((memory) => String(memory.id)),
    };
  } catch (error) {
    console.warn("[Agent Memory] Failed to build instruction memory context:", error);
    return { injectedMemoryIds: [] };
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
    const mode = body.mode === "plan" ? "plan" : "chat";
    const autoExtractMemories = mode === "chat"
      && (body.autoExtractMemories === true || process.env.AGENT_MEMORY_AUTO_EXTRACT === "1");
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
    const instructionMemory = await buildInstructionMemoryContext({ convex, userId });
    if (instructionMemory.injectedMemoryIds.length > 0) {
      tracer.mark("memory_injected", {
        memoryIds: instructionMemory.injectedMemoryIds,
        memoryCount: instructionMemory.injectedMemoryIds.length,
        contentLength: instructionMemory.text?.length ?? 0,
      });
    }
    const encoder = new TextEncoder();
    const responseId = `assistant-${Date.now()}`;

    // 构建可用 tool 列表和映射
    // Plan 模式只暴露 task_plan，避免模型在用户确认前直接执行写入类工具。
    const availableTools = buildAvailableTools(body.currentDocument).filter((tool) =>
      mode === "plan" ? tool.name === "task_plan" : true,
    );
    const toolMap = new Map(availableTools.map((t) => [t.name, t]));
    const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    tracer.mark("run_start", {
      inputMessageCount: messages.length,
      hasCurrentDocument: Boolean(body.currentDocument?.id),
      memoryInjected: Boolean(instructionMemory.text),
      injectedMemoryIds: instructionMemory.injectedMemoryIds,
      toolNames: availableTools.map((tool) => tool.name),
      latestUserTextLength: latestUserText.length,
    });

    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      buildSystemMessage(availableTools.length > 0, instructionMemory.text, mode),
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
          const extraction = extractMemoryCandidates({
            enabled: autoExtractMemories,
            userId,
            conversationId: body.conversationId,
            messages: toMemoryExtractionMessages(messages),
            currentDocument: body.currentDocument,
          });
          await proposeExtractedMemories({
            convex,
            userId,
            conversationId: body.conversationId,
            extraction,
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

function toMemoryExtractionMessages(
  messages: OpenAI.ChatCompletionMessageParam[],
): MemoryExtractionMessage[] {
  return messages.flatMap((message) => {
    if (
      message.role !== "system"
      && message.role !== "user"
      && message.role !== "assistant"
      && message.role !== "tool"
    ) {
      return [];
    }
    return [{ role: message.role, content: message.content }];
  });
}
