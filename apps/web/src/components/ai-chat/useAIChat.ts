"use client";

import { useState, useCallback, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useCurrentDocumentStore } from "@/src/lib/store/use-current-document-store";
import type { ChatMessage, Conversation, ToolCall } from "./types";
import type { AIModelId } from "./models";
import { getInitialAIModelId } from "./models";
import { runAgentStream } from "./stream-client";
import { useAIChatPersistence } from "./useAIChatPersistence";
import type { Id } from "@/convex/_generated/dataModel";

export function useAIChat() {
  const { user } = useUser();
  const t = useTranslations("AI");
  const currentDocument = useCurrentDocumentStore((state) => state.currentDocument);
  const persistence = useAIChatPersistence();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<Date | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [modelId, setModelIdState] = useState<AIModelId>(getInitialAIModelId);
  const [enableThinking] = useState(true);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const setModelId = useCallback((id: AIModelId) => {
    setModelIdState(id);
    localStorage.setItem("ai-model-id", id);
  }, []);

  const refreshConversations = useMemoizedFn(async () => {
    setIsLoadingConversations(true);
    const loaded = await persistence.loadConversations();
    setConversations(loaded);
    setIsLoadingConversations(false);
  });

  const loadConversation = useMemoizedFn(async (convId: Id<"aiConversations">) => {
    if (!user) return;
    try {
      setIsLoading(true);
      setConversationId(convId);

      const formattedMessages = await persistence.loadMessages(convId);
      setMessages(formattedMessages);

      let conversation = conversations.find((conv) => conv._id === convId);
      if (!conversation) {
        const loadedConversations = await persistence.loadConversations();
        setConversations(loadedConversations);
        conversation = loadedConversations.find((conv) => conv._id === convId);
      }
      if (conversation) {
        setConversationCreatedAt(new Date(conversation.createdAt));
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoading(false);
    }
  });

  const createNewConversation = useMemoizedFn(() => {
    setConversationId(null);
    setMessages([]);
    setConversationCreatedAt(null);
    setToolCalls([]);
  });

  const deleteConversation = useMemoizedFn(async (convId: Id<"aiConversations">) => {
    await persistence.deleteConversation(convId, conversationId === convId);
    await refreshConversations();
  });

  const handleGetImages = useMemoizedFn(() => uploadedImages);

  const sendMessage = useMemoizedFn(async (images: string[] = []) => {
    if ((!input.trim() && images.length === 0) || isLoading || !user) return;

    const currentInput = input;
    const currentImages = [...images];

    const messageContent = { text: currentInput, images: currentImages };
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: JSON.stringify(messageContent),
      role: "user",
      timestamp: new Date(),
    };

    setInput("");
    setUploadedImages([]);
    setIsLoading(true);
    setToolCalls([]);
    setMessages((prev) => [...prev, userMessage]);

    const assistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: ChatMessage = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, tempAssistantMessage]);

    let currentContent = "";
    let currentReasoningContent = "";
    let pendingRender = false;

    const flushMessages = () => {
      pendingRender = false;
      setMessages((prev) =>
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
      let currentConversationId = conversationId;
      if (!currentConversationId) {
        const newId = await persistence.createConversation(t("newConversation"));
        if (!newId) throw new Error("Failed to create conversation");
        currentConversationId = newId;
        setConversationId(newId);
        setConversationCreatedAt(new Date());
        refreshConversations();
      }

      persistence.saveMessage(currentConversationId, JSON.stringify(messageContent), "user");

      const conversationHistoryMessages = messages.map((msg) => {
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
        model: modelId,
        conversationId: currentConversationId,
        enableThinking,
        currentDocument,
        callbacks: {
          onChunk: (chunk: string) => { currentContent += chunk; scheduleRender(); },
          onReasoningChunk: (chunk: string) => { if (enableThinking) { currentReasoningContent += chunk; scheduleRender(); } },
          onToolCallStart: (toolCallId: string, toolName: string) => {
            setToolCalls((prev) => [
              ...prev.filter((tc) => tc.id !== toolCallId),
              { id: toolCallId, name: toolName, parameters: {}, status: "calling" },
            ]);
          },
          onToolCallDelta: (toolCallId: string, delta: string) => {
            setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, parameters: { ...tc.parameters, arguments: `${tc.parameters.arguments ?? ""}${delta}` }, status: "executing" }
                  : tc,
              ),
            );
          },
          onToolResultDelta: (toolCallId: string, delta: string) => {
            setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId
                  ? { ...tc, streamingResult: `${tc.streamingResult ?? ""}${delta}`, status: "executing" }
                  : tc,
              ),
            );
          },
          onToolCallResult: (toolCallId: string, result: unknown) => {
            setToolCalls((prev) =>
              prev.map((tc) =>
                tc.id === toolCallId ? { ...tc, result, status: "completed" } : tc,
              ),
            );
          },
          onComplete: async () => {
            pendingRender = false;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMessageId
                  ? { ...msg, content: currentContent, reasoningContent: currentReasoningContent || undefined }
                  : msg,
              ),
            );
            const messageData: Record<string, string> = { content: currentContent };
            if (enableThinking && currentReasoningContent) {
              messageData.reasoningContent = currentReasoningContent;
            }
            await persistence.saveMessage(currentConversationId!, JSON.stringify(messageData), "assistant");
            const title = currentInput.length > 50 ? currentInput.substring(0, 50) + "..." : currentInput || "图片对话";
            await persistence.updateConversationTitle(currentConversationId!, title);
            await refreshConversations();
          },
          onError: (error: unknown) => {
            console.error("Error in Agent stream:", error);
            setMessages((prev) =>
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
      setIsLoading(false);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? { ...msg, content: currentContent || msg.content, reasoningContent: currentReasoningContent || msg.reasoningContent }
            : msg,
        ),
      );
    }
  });

  useEffect(() => {
    if (!user) return;
    refreshConversations();
  }, [user, refreshConversations]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    conversationId,
    conversationCreatedAt,
    conversations,
    isLoadingConversations,
    modelId,
    setModelId,
    enableThinking,
    toolCalls,
    uploadedImages,
    setUploadedImages,
    sendMessage,
    handleGetImages,
    createNewConversation,
    loadConversation,
    deleteConversation,
    loadConversations: refreshConversations,
  };
}
