"use client";

import { useAIChatPersistence } from "./useAIChatPersistence";
import { useAIChatState } from "./useAIChatState";
import { useAIChatStream } from "./useAIChatStream";

/**
 * AI Chat 组合层 Hook
 * 组装 State + Stream + Persistence，对外暴露统一接口
 */
export function useAIChat() {
  const persistence = useAIChatPersistence();
  const state = useAIChatState(persistence);
  const stream = useAIChatStream(state, persistence);

  return {
    messages: state.messages,
    input: state.input,
    setInput: state.setInput,
    isLoading: state.isLoading,
    conversationId: state.conversationId,
    conversationCreatedAt: state.conversationCreatedAt,
    conversations: state.conversations,
    isLoadingConversations: state.isLoadingConversations,
    modelId: state.modelId,
    setModelId: state.setModelId,
    enableThinking: state.enableThinking,
    agentMode: state.agentMode,
    setAgentMode: state.setAgentMode,
    toolCalls: state.toolCalls,
    uploadedImages: state.uploadedImages,
    setUploadedImages: state.setUploadedImages,
    sendMessage: stream.sendMessage,
    resumeLastRun: stream.resumeLastRun,
    canResumeLastRun: stream.canResumeLastRun,
    handleGetImages: stream.handleGetImages,
    createNewConversation: state.createNewConversation,
    loadConversation: state.loadConversation,
    deleteConversation: state.deleteConversation,
    loadConversations: state.refreshConversations,
  };
}
