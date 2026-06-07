import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import OpenAI from "openai";
import { DASHSCOPE_BASE_URL, getActualModelId } from "@notion/ai/config";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildAvailableTools } from "@/src/lib/agent/tools/registry";
import type { CurrentDocumentContext } from "@/src/lib/agent/tools/types";
import { runReActLoop } from "@/src/lib/agent/react-loop";
import { enqueueEvent } from "@/src/lib/agent/stream";
import { AgentRunRecorder } from "@/src/lib/agent/run-recorder";
import { getToolSignature } from "@/src/lib/agent/tool-result-cache";
import { compressContext } from "@/src/lib/agent/context-compression";
import { checkRateLimit } from "@/src/lib/agent/rate-limiter";
import { AgentTracer, getErrorMessage } from "@/src/lib/agent/trace";
import {
  extractMemoryCandidates,
  proposeExtractedMemories,
} from "@/src/lib/agent/memory-extractor";
import type { MemoryExtractionMessage } from "@/src/lib/agent/memory-extractor";

const RESUME_LIVE_POLL_INTERVAL_MS = 800;
const RESUME_LIVE_MAX_WAIT_MS = 25_000;
const RECORDER_FLUSH_TIMEOUT_MS = 1_500;

type AgentRequestBody = {
  messages?: OpenAI.ChatCompletionMessageParam[];
  modelId?: string;
  enableThinking?: boolean;
  conversationId?: string;
  currentDocument?: CurrentDocumentContext | null;
  mode?: "chat" | "plan";
  autoExtractMemories?: boolean;
  resume?: {
    runId: string;
    lastAppliedSeq: number;
    assistantMessageId: string;
  };
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

  let convexAuthToken: string | null = null;
  try {
    convexAuthToken = await getToken({ template: "convex" });
  } catch (error) {
    console.warn("[Agent Stream] Failed to get Convex auth token; continuing without Convex run recording:", error);
    return null;
  }
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
        memory.status === "active"
        && (memory.type === "preference" || memory.type === "project"),
      )
      .sort((a, b) => {
        return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
      })
      .slice(0, 6);
    if (instructionMemories.length === 0) return { injectedMemoryIds: [] };

    const lines: string[] = [];
    let usedChars = 0;
    for (const memory of instructionMemories) {
      const line = `- [${memory.type}] ${memory.summary || memory.content}`;
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
    let convex = await getAuthenticatedConvexClient(getToken);
    if (body.resume) {
      return await buildResumeResponse({
        convex,
        userId,
        resume: body.resume,
      });
    }

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
    const runId = `run_${crypto.randomUUID()}`;

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
    if (convex && body.conversationId) {
      try {
        await convex.mutation(api.aiChat.createAgentRun, {
          runId,
          conversationId: body.conversationId as Id<"aiConversations">,
          assistantMessageId: responseId,
          model,
          mode,
        });
      } catch (error) {
        console.warn("[Agent Stream] Failed to create Agent run; disabling run recording for this response:", error);
        convex = null;
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const recorder = new AgentRunRecorder({
          convex,
          controller,
          encoder,
          runId,
          assistantMessageId: responseId,
        });
        recorder.emitRunStart();
        recorder.checkpoint({
          kind: "run_started",
          resumeState: buildResumeState({
            messages: compressedMessages,
            model,
            enableThinking,
            mode,
            currentDocument: body.currentDocument,
            toolResults: [],
            assistantDraft: recorder.getDraft(),
          }),
        });
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
            eventSink: recorder.emit,
            checkpoint: (payload) => {
              recorder.checkpoint({
                kind: payload.kind,
                resumeState: buildResumeState({
                  messages: payload.messages,
                  model,
                  enableThinking,
                  mode,
                  currentDocument: body.currentDocument,
                  toolResults: payload.completedToolResults,
                  assistantDraft: recorder.getDraft(),
                }),
                metadata: {
                  iteration: payload.iteration,
                },
              });
            },
          });
          recorder.checkpoint({
            kind: "run_finished",
            resumeState: buildResumeState({
              messages: compressedMessages,
              model,
              enableThinking,
              mode,
              currentDocument: body.currentDocument,
              toolResults: [],
              assistantDraft: recorder.getDraft(),
            }),
          });
          recorder.emit({ type: "finish", model, usage: null });
          scheduleMemoryExtraction({
            convex,
            userId,
            conversationId: body.conversationId,
            messages,
            enabled: autoExtractMemories,
            trace: tracer,
          });
          if (convex) {
            void convex.mutation(api.aiChat.finishAgentRun, { runId, status: "completed" })
              .catch((error) => {
                console.warn("[Agent Stream] Failed to mark Agent run completed:", error);
              });
          }
          tracer.event("run_end", elapsedSince(runStartedAt), {
            compressedMessageCount: compressedMessages.length,
          });
        } catch (error) {
          tracer.event("run_error", elapsedSince(runStartedAt), {
            error: getErrorMessage(error),
            compressedMessageCount: compressedMessages.length,
          });
          recorder.checkpoint({
            kind: "run_failed",
            resumeState: buildResumeState({
              messages: compressedMessages,
              model,
              enableThinking,
              mode,
              currentDocument: body.currentDocument,
              toolResults: [],
              assistantDraft: recorder.getDraft(),
            }),
            metadata: { error: getErrorMessage(error) },
          });
          recorder.emit({
            type: "error",
            message: getErrorMessage(error),
          });
          if (convex) {
            void convex.mutation(api.aiChat.finishAgentRun, { runId, status: "failed" })
              .catch((finishError) => {
                console.warn("[Agent Stream] Failed to mark Agent run failed:", finishError);
              });
          }
        } finally {
          await flushRecorderWithTimeout(recorder, "Agent stream");
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

function scheduleMemoryExtraction(options: {
  convex: ConvexHttpClient | null;
  userId: string;
  conversationId?: string;
  messages: OpenAI.ChatCompletionMessageParam[];
  enabled: boolean;
  trace: AgentTracer;
}) {
  void (async () => {
    const extraction = extractMemoryCandidates({
      enabled: options.enabled,
      userId: options.userId,
      conversationId: options.conversationId,
      messages: toMemoryExtractionMessages(options.messages),
    });
    await proposeExtractedMemories({
      convex: options.convex,
      userId: options.userId,
      conversationId: options.conversationId,
      extraction,
      trace: options.trace,
    });
  })().catch((error) => {
    console.warn("[Agent Memory] Failed to propose extracted memories after stream finish:", error);
  });
}

async function flushRecorderWithTimeout(recorder: AgentRunRecorder, label: string) {
  let timedOut = false;
  await Promise.race([
    recorder.flush(),
    delay(RECORDER_FLUSH_TIMEOUT_MS).then(() => {
      timedOut = true;
    }),
  ]);
  if (timedOut) {
    console.warn(`[${label}] Recorder flush timed out; closing client stream without waiting for Convex persistence.`);
  }
}

async function buildResumeResponse(options: {
  convex: ConvexHttpClient | null;
  userId: string;
  resume: NonNullable<AgentRequestBody["resume"]>;
}) {
  const { convex, resume, userId } = options;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (!convex) {
        enqueueEvent(controller, encoder, {
          type: "resume-unavailable",
          runId: resume.runId,
          reason: "Convex client is not available",
          recoverable: false,
        });
        controller.close();
        return;
      }

      try {
        const backlog = await convex.query(api.aiChat.getAgentRunBacklog, {
          runId: resume.runId,
          afterSeq: resume.lastAppliedSeq,
          limit: 1000,
        });
        enqueueEvent(controller, encoder, {
          type: "resume-start",
          runId: resume.runId,
          fromSeq: resume.lastAppliedSeq,
          replayedCount: backlog.events.length,
        });
        let lastAppliedSeq = resume.lastAppliedSeq;
        let hasFinishEvent = false;
        for (const event of backlog.events) {
          controller.enqueue(encoder.encode(`${event.eventJson}\n`));
          lastAppliedSeq = Math.max(lastAppliedSeq, event.seq);
          hasFinishEvent = hasFinishEvent || eventJsonHasType(event.eventJson, "finish");
        }

        const liveResult = backlog.run.status === "running"
          ? await streamRunningRunBacklog({
            convex,
            controller,
            encoder,
            runId: resume.runId,
            afterSeq: lastAppliedSeq,
          })
          : {
            status: backlog.run.status,
            lastSeq: backlog.run.lastSeq,
            hasFinishEvent,
          };

        if (liveResult.status === "running") {
          enqueueEvent(controller, encoder, {
            type: "error",
            message: "Resume stream is still running. Please continue generation again.",
          });
          return;
        }

        if (liveResult.status === "failed") {
          const checkpoint = await convex.query(api.aiChat.getLatestAgentRunCheckpoint, {
            runId: resume.runId,
          });
          if (!checkpoint) {
            enqueueEvent(controller, encoder, {
              type: "resume-unavailable",
              runId: resume.runId,
              reason: "No checkpoint is available for this failed run.",
              recoverable: false,
            });
            return;
          }
          await resumeFromCheckpoint({
            convex,
            controller,
            encoder,
            runId: resume.runId,
            assistantMessageId: resume.assistantMessageId,
            initialSeq: liveResult.lastSeq,
            checkpointJson: checkpoint.checkpointJson,
            userId,
          });
        } else if (liveResult.status === "completed" && !liveResult.hasFinishEvent) {
          enqueueEvent(controller, encoder, { type: "finish", model: backlog.run.model, usage: null });
        }
      } catch (error) {
        enqueueEvent(controller, encoder, {
          type: "resume-unavailable",
          runId: resume.runId,
          reason: getErrorMessage(error),
          recoverable: false,
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
}

async function streamRunningRunBacklog(options: {
  convex: ConvexHttpClient;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  runId: string;
  afterSeq: number;
}): Promise<{
  status: "running" | "completed" | "failed" | "cancelled";
  lastSeq: number;
  hasFinishEvent: boolean;
}> {
  const startedAt = Date.now();
  let cursor = options.afterSeq;
  let status: "running" | "completed" | "failed" | "cancelled" = "running";
  let lastSeq = options.afterSeq;
  let hasFinishEvent = false;

  while (Date.now() - startedAt < RESUME_LIVE_MAX_WAIT_MS) {
    await delay(RESUME_LIVE_POLL_INTERVAL_MS);
    const backlog = await options.convex.query(api.aiChat.getAgentRunBacklog, {
      runId: options.runId,
      afterSeq: cursor,
      limit: 1000,
    });

    status = backlog.run.status;
    lastSeq = backlog.run.lastSeq;
    for (const event of backlog.events) {
      options.controller.enqueue(options.encoder.encode(`${event.eventJson}\n`));
      cursor = Math.max(cursor, event.seq);
      lastSeq = Math.max(lastSeq, event.seq);
      hasFinishEvent = hasFinishEvent || eventJsonHasType(event.eventJson, "finish");
    }

    if (status !== "running") {
      return { status, lastSeq, hasFinishEvent };
    }
  }

  return { status, lastSeq, hasFinishEvent };
}

function eventJsonHasType(eventJson: string, type: string): boolean {
  try {
    const parsed = JSON.parse(eventJson) as { type?: unknown };
    return parsed.type === type;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resumeFromCheckpoint(options: {
  convex: ConvexHttpClient;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  runId: string;
  assistantMessageId: string;
  initialSeq: number;
  checkpointJson: string;
  userId: string;
}) {
  const checkpoint = parseCheckpoint(options.checkpointJson);
  if (!checkpoint) {
    enqueueEvent(options.controller, options.encoder, {
      type: "resume-unavailable",
      runId: options.runId,
      reason: "Checkpoint payload is invalid.",
      recoverable: false,
    });
    return;
  }

  const recorder = new AgentRunRecorder({
    convex: options.convex,
    controller: options.controller,
    encoder: options.encoder,
    runId: options.runId,
    assistantMessageId: options.assistantMessageId,
    initialSeq: options.initialSeq,
  });
  const mode = checkpoint.resumeState.mode === "plan" ? "plan" : "chat";
  const model = checkpoint.resumeState.model;
  const restoredCurrentDocument = await restoreCurrentDocumentFromCheckpoint(
    options.convex,
    checkpoint.resumeState.currentDocument,
  );
  const availableTools = buildAvailableTools(restoredCurrentDocument).filter((tool) =>
    mode === "plan" ? tool.name === "task_plan" : true,
  );
  const toolMap = new Map(availableTools.map((t) => [t.name, t]));
  const openaiTools: OpenAI.ChatCompletionTool[] = availableTools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  await options.convex.mutation(api.aiChat.finishAgentRun, { runId: options.runId, status: "running" });
  try {
    await runReActLoop({
      openai: getOpenAIClient(),
      model,
      messages: checkpoint.resumeState.compressedMessages,
      tools: openaiTools,
      toolMap,
      toolContext: {
        userId: options.userId,
        model,
        currentDocument: restoredCurrentDocument,
        convex: options.convex,
      },
      enableThinking: checkpoint.resumeState.enableThinking,
      controller: options.controller,
      encoder: options.encoder,
      responseId: options.assistantMessageId,
      eventSink: recorder.emit,
      resumeToolResults: buildResumeToolCache(checkpoint.resumeState.toolResults),
      checkpoint: (payload) => {
        recorder.checkpoint({
          kind: payload.kind,
          resumeState: {
            ...checkpoint.resumeState,
            compressedMessages: payload.messages,
            toolResults: payload.completedToolResults,
            assistantDraft: recorder.getDraft(),
          },
          metadata: { resumed: true, iteration: payload.iteration },
        });
      },
    });
    recorder.checkpoint({
      kind: "run_finished",
      resumeState: {
        ...checkpoint.resumeState,
        assistantDraft: recorder.getDraft(),
      },
      metadata: { resumed: true },
    });
    recorder.emit({ type: "finish", model, usage: null });
    await options.convex.mutation(api.aiChat.finishAgentRun, { runId: options.runId, status: "completed" });
  } catch (error) {
    recorder.checkpoint({
      kind: "run_failed",
      resumeState: checkpoint.resumeState,
      metadata: { resumed: true, error: getErrorMessage(error) },
    });
    recorder.emit({ type: "error", message: getErrorMessage(error) });
    await options.convex.mutation(api.aiChat.finishAgentRun, { runId: options.runId, status: "failed" });
  } finally {
    await recorder.flush();
  }
}

interface ParsedCheckpoint {
  resumeState: {
    compressedMessages: OpenAI.ChatCompletionMessageParam[];
    model: string;
    enableThinking: boolean;
    mode: "chat" | "plan";
    currentDocument?: {
      id: string;
      title?: string;
      contentHash?: string;
    } | null;
    toolResults: Array<{
      toolName: string;
      argumentsJson: string;
      result: unknown;
    }>;
    assistantDraft: { text: string; reasoning?: string };
  };
}

function parseCheckpoint(value: string): ParsedCheckpoint | null {
  try {
    const parsed = JSON.parse(value) as { resumeState?: unknown };
    const resumeState = parsed.resumeState as ParsedCheckpoint["resumeState"] | undefined;
    if (!resumeState || !Array.isArray(resumeState.compressedMessages)) return null;
    if (typeof resumeState.model !== "string") return null;
    return {
      resumeState: {
        compressedMessages: resumeState.compressedMessages,
        model: resumeState.model,
        enableThinking: Boolean(resumeState.enableThinking),
        mode: resumeState.mode === "plan" ? "plan" : "chat",
        currentDocument: normalizeCheckpointDocument(resumeState.currentDocument),
        toolResults: Array.isArray(resumeState.toolResults) ? resumeState.toolResults : [],
        assistantDraft: resumeState.assistantDraft ?? { text: "" },
      },
    };
  } catch {
    return null;
  }
}

async function restoreCurrentDocumentFromCheckpoint(
  convex: ConvexHttpClient,
  checkpointDocument: ParsedCheckpoint["resumeState"]["currentDocument"],
): Promise<CurrentDocumentContext | null> {
  if (!checkpointDocument?.id) return null;
  try {
    const document = await convex.query(api.documents.getById, {
      documentId: checkpointDocument.id as Id<"documents">,
    });
    return {
      id: checkpointDocument.id,
      title: typeof document.title === "string" ? document.title : checkpointDocument.title ?? "Untitled",
      content: normalizeDocumentContent(document.content),
    };
  } catch (error) {
    console.warn("[Agent Resume] Failed to restore current document:", error);
    return null;
  }
}

function normalizeCheckpointDocument(value: unknown): ParsedCheckpoint["resumeState"]["currentDocument"] {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string") return null;
  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : undefined,
    contentHash: typeof record.contentHash === "string" ? record.contentHash : undefined,
  };
}

function normalizeDocumentContent(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value == null) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function buildResumeToolCache(toolResults: ParsedCheckpoint["resumeState"]["toolResults"]) {
  return Object.fromEntries(
    toolResults.flatMap((toolResult) => {
      if (typeof toolResult.toolName !== "string" || typeof toolResult.argumentsJson !== "string") {
        return [];
      }
      const args = safeParseRecord(toolResult.argumentsJson);
      const resultStr = JSON.stringify(toolResult.result);
      return [[getToolSignature(toolResult.toolName, args), resultStr]];
    }),
  );
}

function safeParseRecord(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function buildResumeState(options: {
  messages: OpenAI.ChatCompletionMessageParam[];
  model: string;
  enableThinking: boolean;
  mode: "chat" | "plan";
  currentDocument?: CurrentDocumentContext | null;
  toolResults: Array<{
    toolCallId: string;
    toolName: string;
    argumentsJson: string;
    result: unknown;
    resultHash: string;
    completedAt: number;
  }>;
  assistantDraft: { text: string; reasoning?: string };
}) {
  return {
    compressedMessages: options.messages,
    model: options.model,
    enableThinking: options.enableThinking,
    mode: options.mode,
    currentDocument: options.currentDocument
      ? {
        id: options.currentDocument.id,
        title: options.currentDocument.title,
        contentHash: hashString(options.currentDocument.content ?? ""),
      }
      : null,
    toolResults: options.toolResults,
    assistantDraft: options.assistantDraft,
  };
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
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
