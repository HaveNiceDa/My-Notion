"use client";

import { useEffect, useState } from "react";
import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCurrentDocumentStore } from "@/src/lib/store/use-current-document-store";
import type { AgentRunMode, AgentStreamResumeCursor, ChatMessage, ToolCallResult } from "./types";
import { runAgentStream } from "./stream-client";
import type { useAIChatPersistence } from "./useAIChatPersistence";
import type { useAIChatState } from "./useAIChatState";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * AI Chat 流式发送 Hook
 * 处理消息发送、Agent 流式响应解析、toolCalls 追踪、rAF 渲染调度、消息持久化
 */
export function useAIChatStream(
  state: ReturnType<typeof useAIChatState>,
  persistence: ReturnType<typeof useAIChatPersistence>,
) {
  const { user } = useUser();
  const t = useTranslations("AI");
  const currentDocument = useCurrentDocumentStore((s) => s.currentDocument);
  const [storedResumeCursor, setStoredResumeCursor] = useState<AgentStreamResumeCursor | null>(null);

  const handleGetImages = useMemoizedFn(() => state.uploadedImages);

  useEffect(() => {
    setStoredResumeCursor(readResumeCursor(state.conversationId));
  }, [state.conversationId]);

  const sendMessage = useMemoizedFn(async (
    images: string[] = [],
    options: { inputOverride?: string; mode?: AgentRunMode } = {},
  ) => {
    const currentInput = options.inputOverride ?? state.input;
    const runMode = options.mode ?? state.agentMode;
    if ((!currentInput.trim() && images.length === 0) || state.isLoading || !user) return;

    const currentImages = [...images];

    const messageContent = { text: currentInput, images: currentImages };
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: JSON.stringify(messageContent),
      role: "user",
      timestamp: new Date(),
    };

    if (!options.inputOverride) {
      state.setInput("");
    }
    state.setUploadedImages([]);
    state.setIsLoading(true);
    state.setToolCalls([]);
    state.setMessages((prev) => [...prev, userMessage]);

    const assistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };
    state.setMessages((prev) => [...prev, tempAssistantMessage]);

    let currentContent = "";
    let currentReasoningContent = "";
    let pendingRender = false;
    let completedToolResults: ToolCallResult[] = [];
    const toolArgumentsById = new Map<string, string>();
    let activeResumeCursor: AgentStreamResumeCursor | null = null;

    const flushMessages = () => {
      pendingRender = false;
      state.setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: currentContent, reasoningContent: currentReasoningContent || undefined }
            : msg,
        ),
      );
    };

    const scheduleRender = () => {
      if (!pendingRender) {
        pendingRender = true;
        requestAnimationFrame(flushMessages);
      }
    };

    try {
      let currentConversationId = state.conversationId;
      if (!currentConversationId) {
        const newId = await persistence.createConversation(t("newConversation"));
        if (!newId) throw new Error("Failed to create conversation");
        currentConversationId = newId;
        state.setConversationId(newId);
        state.setConversationCreatedAt(new Date());
        state.refreshConversations();
      }

      persistence.saveMessage(currentConversationId, JSON.stringify(messageContent), "user");

      const conversationHistoryMessages = state.messages.map((msg) => {
        try {
          const parsedContent = JSON.parse(msg.content);
          if (parsedContent.images && parsedContent.images.length > 0) {
            const content = [
              { type: "text", text: parsedContent.text || "" },
              ...parsedContent.images.map((image: string) => ({
                type: "image_url",
                image_url: { url: image },
              })),
            ];
            return { role: msg.role, content };
          } else if (typeof parsedContent.text === "string") {
            return { role: msg.role, content: parsedContent.text };
          } else {
            return { role: msg.role, content: msg.content };
          }
        } catch {
          return { role: msg.role, content: msg.content };
        }
      });

      const currentMessageContent = [
        { type: "text", text: currentInput || "" },
        ...currentImages.map((image) => ({ type: "image_url", image_url: { url: image } })),
      ];
      conversationHistoryMessages.push({ role: "user", content: currentMessageContent });

      await runAgentStream({
        messages: conversationHistoryMessages,
        model: state.modelId,
        conversationId: currentConversationId,
        enableThinking: state.enableThinking,
        currentDocument,
        mode: runMode,
        callbacks: {
          onChunk: (chunk: string) => { currentContent += chunk; scheduleRender(); },
          onReasoningChunk: (chunk: string) => { if (state.enableThinking) { currentReasoningContent += chunk; scheduleRender(); } },
          onToolCallStart: (toolCallId: string, toolName: string) => {
            toolArgumentsById.set(toolCallId, "");
            state.setToolCalls((prev) => [
              ...prev.filter((tc) => tc.id !== toolCallId),
              { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
            ]);
            completedToolResults = [
              ...completedToolResults.filter((result) => result.id !== toolCallId),
              { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
            ];
          },
          onToolCallDelta: (toolCallId: string, delta: string) => {
            const nextArguments = `${toolArgumentsById.get(toolCallId) ?? ""}${delta}`;
            toolArgumentsById.set(toolCallId, nextArguments);
            state.setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, parameters: { ...tc.parameters, arguments: nextArguments }, status: "executing" }
                  : tc,
              ),
            );
            const existingIdx = completedToolResults.findIndex((r) => r.id === toolCallId);
            if (existingIdx >= 0) {
              completedToolResults[existingIdx] = {
                ...completedToolResults[existingIdx],
                parameters: { arguments: nextArguments },
                status: "executing",
              };
            }
          },
          onToolResultDelta: (toolCallId: string, delta: string) => {
            state.setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, streamingResult: `${tc.streamingResult ?? ""}${delta}`, status: "executing" }
                  : tc,
              ),
            );
          },
          onToolCallResult: (toolCallId: string, result: unknown) => {
            state.setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId ? { ...tc, result, status: "completed" } : tc,
              ),
            );
            const existingIdx = completedToolResults.findIndex((r) => r.id === toolCallId);
            if (existingIdx >= 0) {
              completedToolResults[existingIdx] = {
                ...completedToolResults[existingIdx],
                parameters: { arguments: toolArgumentsById.get(toolCallId) ?? "" },
                status: "completed",
                result,
              };
            }
          },
          onRunStart: (cursor) => {
            activeResumeCursor = cursor;
            persistResumeCursor(currentConversationId!, cursor);
            setStoredResumeCursor(cursor);
          },
          onCheckpoint: (cursor) => {
            activeResumeCursor = cursor;
            persistResumeCursor(currentConversationId!, cursor);
            setStoredResumeCursor(cursor);
          },
          onResumeUnavailable: (reason, recoverable) => {
            console.warn("[Agent] Resume unavailable:", reason);
            if (!recoverable) {
              clearResumeCursor(currentConversationId!);
              setStoredResumeCursor(null);
            }
          },
          onComplete: async () => {
            pendingRender = false;
            state.setIsLoading(false);
            const finalToolResults = completedToolResults.length > 0 ? completedToolResults : undefined;
            state.setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: currentContent, reasoningContent: currentReasoningContent || undefined, toolResults: finalToolResults }
                  : msg,
              ),
            );
            const messageData: Record<string, string> = { content: currentContent };
            if (state.enableThinking && currentReasoningContent) {
              messageData.reasoningContent = currentReasoningContent;
            }
            if (finalToolResults) {
              messageData.toolResults = JSON.stringify(finalToolResults);
            }
            const savedAssistantMessageId = await persistence.saveMessage(
              currentConversationId!,
              JSON.stringify(messageData),
              "assistant",
            );
            if (savedAssistantMessageId) {
              state.setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMessageId
                    ? { ...msg, id: savedAssistantMessageId }
                    : msg,
                ),
              );
            }
            clearResumeCursor(currentConversationId!);
            setStoredResumeCursor(null);
            const title = currentInput.length > 50 ? currentInput.substring(0, 50) + "..." : currentInput || "图片对话";
            await persistence.updateConversationTitle(currentConversationId!, title);
            await state.refreshConversations();
          },
          onError: (error: unknown) => {
            console.error("Error in Agent stream:", error);
            state.setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? {
                    ...msg,
                    content: currentContent || t("resumeInterrupted"),
                    reasoningContent: currentReasoningContent || msg.reasoningContent,
                  }
                  : msg,
              ),
            );
          },
        },
      });
    } finally {
      state.setIsLoading(false);
      const finalToolResults = completedToolResults.length > 0 ? completedToolResults : undefined;
      state.setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: currentContent || msg.content, reasoningContent: currentReasoningContent || msg.reasoningContent, toolResults: finalToolResults ?? msg.toolResults }
            : msg,
        ),
      );
    }
  });

  const resumeLastRun = useMemoizedFn(async () => {
    const currentConversationId = state.conversationId;
    const cursor = storedResumeCursor ?? readResumeCursor(currentConversationId);
    if (!currentConversationId || !cursor || state.isLoading || !user) return;

    const assistantMessage = [...state.messages].reverse().find((msg) => msg.role === "assistant");
    if (!assistantMessage) return;

    state.setIsLoading(true);
    state.setToolCalls([]);

    const assistantMessageId = assistantMessage.id;
    let currentContent = getAssistantContent(assistantMessage);
    let currentReasoningContent = assistantMessage.reasoningContent ?? "";
    let pendingRender = false;
    let completedToolResults: ToolCallResult[] = assistantMessage.toolResults ?? [];
    const toolArgumentsById = new Map<string, string>();
    let activeResumeCursor: AgentStreamResumeCursor | null = cursor;

    const flushMessages = () => {
      pendingRender = false;
      state.setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: currentContent, reasoningContent: currentReasoningContent || undefined }
            : msg,
        ),
      );
    };

    const scheduleRender = () => {
      if (!pendingRender) {
        pendingRender = true;
        requestAnimationFrame(flushMessages);
      }
    };

    try {
      await runAgentStream({
        messages: [],
        model: state.modelId,
        conversationId: currentConversationId,
        enableThinking: state.enableThinking,
        currentDocument,
        resume: cursor,
        callbacks: {
          onChunk: (chunk) => { currentContent += chunk; scheduleRender(); },
          onReasoningChunk: (chunk) => { if (state.enableThinking) { currentReasoningContent += chunk; scheduleRender(); } },
          onToolCallStart: (toolCallId, toolName) => {
            toolArgumentsById.set(toolCallId, "");
            state.setToolCalls((prev) => [
              ...prev.filter((tc) => tc.id !== toolCallId),
              { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
            ]);
            completedToolResults = [
              ...completedToolResults.filter((result) => result.id !== toolCallId),
              { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
            ];
          },
          onToolCallDelta: (toolCallId, delta) => {
            const nextArguments = `${toolArgumentsById.get(toolCallId) ?? ""}${delta}`;
            toolArgumentsById.set(toolCallId, nextArguments);
            state.setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, parameters: { ...tc.parameters, arguments: nextArguments }, status: "executing" }
                  : tc,
              ),
            );
          },
          onToolResultDelta: (toolCallId, delta) => {
            state.setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, streamingResult: `${tc.streamingResult ?? ""}${delta}`, status: "executing" }
                  : tc,
              ),
            );
          },
          onToolCallResult: (toolCallId, result) => {
            state.setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId ? { ...tc, result, status: "completed" } : tc,
              ),
            );
            const existingIdx = completedToolResults.findIndex((item) => item.id === toolCallId);
            const nextResult: ToolCallResult = {
              id: toolCallId,
              name: completedToolResults[existingIdx]?.name ?? "unknown",
              parameters: { arguments: toolArgumentsById.get(toolCallId) ?? "" },
              status: "completed",
              result,
            };
            completedToolResults = existingIdx >= 0
              ? completedToolResults.map((item, index) => index === existingIdx ? nextResult : item)
              : [...completedToolResults, nextResult];
          },
          onRunStart: (nextCursor) => {
            activeResumeCursor = nextCursor;
            persistResumeCursor(currentConversationId, nextCursor);
            setStoredResumeCursor(nextCursor);
          },
          onCheckpoint: (nextCursor) => {
            activeResumeCursor = nextCursor;
            persistResumeCursor(currentConversationId, nextCursor);
            setStoredResumeCursor(nextCursor);
          },
          onResumeUnavailable: (reason, recoverable) => {
            console.warn("[Agent] Resume unavailable:", reason);
            if (!recoverable) {
              clearResumeCursor(currentConversationId);
              setStoredResumeCursor(null);
            }
          },
          onComplete: async () => {
            pendingRender = false;
            state.setIsLoading(false);
            const finalToolResults = completedToolResults.length > 0 ? completedToolResults : undefined;
            state.setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: currentContent, reasoningContent: currentReasoningContent || undefined, toolResults: finalToolResults }
                  : msg,
              ),
            );

            if (isTemporaryMessageId(assistantMessageId)) {
              const messageData: Record<string, string> = { content: currentContent };
              if (state.enableThinking && currentReasoningContent) {
                messageData.reasoningContent = currentReasoningContent;
              }
              if (finalToolResults) {
                messageData.toolResults = JSON.stringify(finalToolResults);
              }
              const savedAssistantMessageId = await persistence.saveMessage(
                currentConversationId,
                JSON.stringify(messageData),
                "assistant",
              );
              if (savedAssistantMessageId) {
                state.setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId ? { ...msg, id: savedAssistantMessageId } : msg,
                  ),
                );
              }
            } else {
              await persistence.updateAssistantMessage(
                assistantMessageId as Id<"aiMessages">,
                buildAssistantMessagePayload({
                  content: currentContent,
                  reasoningContent: state.enableThinking ? currentReasoningContent : undefined,
                  toolResults: finalToolResults,
                }),
              );
            }

            activeResumeCursor = null;
            clearResumeCursor(currentConversationId);
            setStoredResumeCursor(null);
            await state.refreshConversations();
          },
          onError: (error) => {
            console.error("Error resuming Agent stream:", error);
            if (activeResumeCursor) {
              persistResumeCursor(currentConversationId, activeResumeCursor);
              setStoredResumeCursor(activeResumeCursor);
            }
          },
        },
      });
    } finally {
      state.setIsLoading(false);
    }
  });

  return {
    sendMessage,
    resumeLastRun,
    canResumeLastRun: Boolean(storedResumeCursor && state.conversationId && !state.isLoading),
    handleGetImages,
  };
}

function persistResumeCursor(conversationId: string, cursor: AgentStreamResumeCursor) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    `mynotion:agent-resume:${conversationId}`,
    JSON.stringify(cursor),
  );
}

function readResumeCursor(conversationId: string | null): AgentStreamResumeCursor | null {
  if (!conversationId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`mynotion:agent-resume:${conversationId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AgentStreamResumeCursor>;
    if (
      typeof parsed.runId === "string" &&
      typeof parsed.lastAppliedSeq === "number" &&
      typeof parsed.assistantMessageId === "string"
    ) {
      return {
        runId: parsed.runId,
        lastAppliedSeq: parsed.lastAppliedSeq,
        assistantMessageId: parsed.assistantMessageId,
      };
    }
  } catch {}
  return null;
}

function clearResumeCursor(conversationId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`mynotion:agent-resume:${conversationId}`);
}

function getAssistantContent(message: ChatMessage): string {
  try {
    const parsed = JSON.parse(message.content) as { content?: unknown; text?: unknown };
    if (typeof parsed.content === "string") return parsed.content;
    if (typeof parsed.text === "string") return parsed.text;
  } catch {}
  return message.content;
}

function isTemporaryMessageId(messageId: string): boolean {
  return /^\d+$/.test(messageId);
}

function buildAssistantMessagePayload(args: {
  content: string;
  reasoningContent?: string;
  toolResults?: ToolCallResult[];
}): string {
  const messageData: Record<string, string> = { content: args.content };
  if (args.reasoningContent) {
    messageData.reasoningContent = args.reasoningContent;
  }
  if (args.toolResults) {
    messageData.toolResults = JSON.stringify(args.toolResults);
  }
  return JSON.stringify(messageData);
}
