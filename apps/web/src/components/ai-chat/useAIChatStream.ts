"use client";

import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCurrentDocumentStore } from "@/src/lib/store/use-current-document-store";
import type { AgentRunMode, ChatMessage, ToolCallResult } from "./types";
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

  const handleGetImages = useMemoizedFn(() => state.uploadedImages);

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
            completedToolResults.push({ id: toolCallId, name: toolName, parameters: {}, status: "calling" });
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
          onComplete: async () => {
            pendingRender = false;
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
            const title = currentInput.length > 50 ? currentInput.substring(0, 50) + "..." : currentInput || "图片对话";
            await persistence.updateConversationTitle(currentConversationId!, title);
            await state.refreshConversations();
          },
          onError: (error: unknown) => {
            console.error("Error in Agent stream:", error);
            state.setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: "Sorry, something went wrong. Please try again." }
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

  return {
    sendMessage,
    handleGetImages,
  };
}
