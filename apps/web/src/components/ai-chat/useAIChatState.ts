"use client";

import { useState, useCallback, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useAIChatStore } from "@/src/lib/store/use-ai-chat-store";
import type { AgentRunMode, ChatMessage, Conversation, ToolCall } from "./types";
import type { AIModelId } from "./models";
import { getInitialAIModelId } from "./models";
import type { useAIChatPersistence } from "./useAIChatPersistence";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * AI Chat 状态管理 Hook
 * 管理所有 useState、模型选择持久化、会话 CRUD、面板打开时自动加载会话列表
 */
export function useAIChatState(persistence: ReturnType<typeof useAIChatPersistence>) {
  const { user } = useUser();
  const panelOpen = useAIChatStore((state) => state.panelOpen);

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
  const [agentMode, setAgentMode] = useState<AgentRunMode>("chat");

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

  useEffect(() => {
    if (!user || !panelOpen) return;
    refreshConversations();
  }, [user, panelOpen, refreshConversations]);

  return {
    input, setInput,
    messages, setMessages,
    conversationId, setConversationId,
    conversationCreatedAt, setConversationCreatedAt,
    conversations, setConversations,
    isLoading, setIsLoading,
    isLoadingConversations,
    modelId, setModelId,
    enableThinking,
    agentMode, setAgentMode,
    toolCalls, setToolCalls,
    uploadedImages, setUploadedImages,
    refreshConversations,
    loadConversation,
    createNewConversation,
    deleteConversation,
  };
}
