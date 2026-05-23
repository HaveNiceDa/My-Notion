import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import OpenAI from "openai";
import { DASHSCOPE_BASE_URL, getActualModelId } from "@notion/ai/config";
import { buildAvailableTools } from "@/src/lib/agent/tools/registry";
import type { CurrentDocumentContext } from "@/src/lib/agent/tools/types";
import { runReActLoop } from "@/src/lib/agent/react-loop";
import { enqueueEvent } from "@/src/lib/agent/stream";
import { compressContext } from "@/src/lib/agent/context-compression";

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

function buildSystemMessage(
  hasToolContext: boolean,
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
    ].join("\n"),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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
    const openai = getOpenAIClient();
    const encoder = new TextEncoder();
    const responseId = `assistant-${Date.now()}`;

    // 构建可用 tool 列表和映射
    const availableTools = buildAvailableTools(body.currentDocument);
    const toolMap = new Map(availableTools.map((t) => [t.name, t]));
    const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));

    const allMessages: OpenAI.ChatCompletionMessageParam[] = [
      buildSystemMessage(availableTools.length > 0),
      ...messages,
    ];

    // 长对话上下文压缩：token 超阈值时摘要旧消息 + 保留最近 N 轮
    const compressedMessages = await compressContext(openai, model, allMessages);

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          await runReActLoop({
            openai,
            model,
            messages: compressedMessages,
            tools: openaiTools,
            toolMap,
            toolContext: { userId, model, currentDocument: body.currentDocument },
            enableThinking,
            controller,
            encoder,
            responseId,
          });
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
