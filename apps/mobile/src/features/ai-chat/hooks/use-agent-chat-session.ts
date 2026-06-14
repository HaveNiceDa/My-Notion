import { useAuth, useUser } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { streamAgent } from "@/lib/ai/agent-stream";
import {
  buildMessages,
  DEFAULT_MODEL,
  streamChat,
  streamRAG,
  type AIModel,
  type ChatMessage,
} from "@/lib/ai/chat";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AgentChatStatus,
  ThinkingStep,
} from "../types";

const MOBILE_AGENT_STREAM_ENABLED =
  process.env.EXPO_PUBLIC_MOBILE_AGENT_STREAM !== "0";

export function useAgentChatSession(visible: boolean) {
  const { user } = useUser();
  const { getToken } = useAuth();

  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AgentChatStatus>("idle");
  const [streamingContent, setStreamingContent] = useState("");
  const [reasoningContent, setReasoningContent] = useState("");
  const [completedReasoning, setCompletedReasoning] = useState("");
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const [activeConversationId, setActiveConversationId] =
    useState<Id<"aiConversations"> | null>(null);
  const [selectedModel, setSelectedModel] = useState<AIModel>(DEFAULT_MODEL);
  const [enableThinking, setEnableThinking] = useState(false);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(true);
  const [thinkingSteps, setThinkingSteps] = useState<ThinkingStep[]>([]);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [resumeCursor, setResumeCursor] = useState<{
    runId: string;
    lastAppliedSeq: number;
    assistantMessageId: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatingNewRef = useRef(false);
  const activeInputRef = useRef<string | null>(null);

  const createConversation = useMutation(api.aiChat.createConversation);
  const addMessage = useMutation(api.aiChat.addMessage);
  const deleteConversation = useMutation(api.aiChat.deleteConversation);
  const updateConversationTitle = useMutation(api.aiChat.updateConversationTitle);

  const conversations = useQuery(api.aiChat.getConversations, user ? {} : "skip");

  const convexMessages = useQuery(
    api.aiChat.getMessages,
    activeConversationId ? { conversationId: activeConversationId } : "skip",
  );

  const isSending = status === "preparing" || status === "streaming";

  const addThinkingStep = useCallback(
    (type: string, content: string, details?: string) => {
      setThinkingSteps((steps) => [...steps, { type, content, details }]);
    },
    [],
  );

  const clearThinkingSteps = useCallback(() => {
    setThinkingSteps([]);
  }, []);

  const resetDraft = useCallback(() => {
    setStreamingContent("");
    setReasoningContent("");
    setCompletedReasoning("");
    clearThinkingSteps();
  }, [clearThinkingSteps]);

  useEffect(() => {
    if (
      conversations &&
      conversations.length > 0 &&
      !activeConversationId &&
      !isCreatingNewRef.current
    ) {
      setActiveConversationId(conversations[0]._id);
    }
  }, [conversations, activeConversationId]);

  useEffect(() => {
    if (visible) {
      isCreatingNewRef.current = false;
    }
  }, [visible]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus(resumeCursor ? "resumable" : "failed");
    setLastFailedInput(activeInputRef.current);
  }, [resumeCursor]);

  const handleSend = useCallback(async (retryInput?: string) => {
    const messageText = retryInput ?? input.trim();
    if (!messageText || !user || isSending) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    activeInputRef.current = messageText;

    setStatus("preparing");
    setLastFailedInput(null);
    setResumeCursor(null);
    isCreatingNewRef.current = false;
    if (!retryInput) setInput("");
    resetDraft();

    let fullContent = "";
    let fullReasoning = "";
    let conversationId = activeConversationId;

    const fail = (error: Error) => {
      if (abortController.signal.aborted) {
        setStatus(resumeCursor ? "resumable" : "failed");
        setLastFailedInput(messageText);
        return;
      }

      console.error("AI stream error:", error);
      setStatus("failed");
      setStreamingContent("");
      setReasoningContent("");
      setLastFailedInput(messageText);
    };

    try {
      const isNewConversation = !conversationId;

      if (!conversationId) {
        conversationId = await createConversation({
          title: messageText.slice(0, 30),
        });
        setActiveConversationId(conversationId);
      }

      await addMessage({
        conversationId,
        content: messageText,
        role: "user",
      });

      if (isNewConversation) {
        try {
          await updateConversationTitle({
            conversationId,
            title: messageText.slice(0, 30),
          });
        } catch {}
      }

      const history: ChatMessage[] = (convexMessages ?? [])
        .filter((msg: any) => msg.role === "user" || msg.role === "assistant")
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

      const authToken = await getToken();
      setStatus("streaming");

      const callbacks = {
        onContent: (text: string) => {
          fullContent += text;
          setStreamingContent(fullContent);
        },
        onReasoning: (text: string) => {
          fullReasoning += text;
          setReasoningContent(fullReasoning);
          setReasoningExpanded(true);
        },
        onThinkingStep: (step: { type: string; content: string; details?: string }) => {
          addThinkingStep(step.type, step.content, step.details);
        },
        onError: fail,
        onComplete: async () => {
          if (abortController.signal.aborted) return;

          if (fullReasoning) {
            setCompletedReasoning(fullReasoning);
            setReasoningContent("");
            setReasoningExpanded(false);
          }
          if (conversationId && fullContent) {
            try {
              await addMessage({
                conversationId,
                content: fullContent,
                role: "assistant",
              });
            } catch (err) {
              console.error("Failed to save assistant message:", err);
            }
          }
          setStreamingContent("");
          setStatus("done");
          abortControllerRef.current = null;
          activeInputRef.current = null;
        },
      };

      if (MOBILE_AGENT_STREAM_ENABLED) {
        await streamAgent(
          {
            messages: [
              ...history,
              { role: "user", content: messageText },
            ],
            modelId: selectedModel,
            conversationId: conversationId ?? undefined,
            enableThinking,
            currentDocument: null,
            authToken,
            signal: abortController.signal,
          },
          {
            onRunStart: (cursor) => {
              setResumeCursor(cursor);
              console.log("[Mobile Agent Stream] run started", cursor.runId);
            },
            onCheckpoint: (cursor, checkpointKind) => {
              setResumeCursor(cursor);
              console.log(
                "[Mobile Agent Stream] checkpoint",
                checkpointKind,
                cursor.lastAppliedSeq,
              );
            },
            onTextDelta: callbacks.onContent,
            onReasoningDelta: callbacks.onReasoning,
            onToolEvent: (event) => {
              console.log("[Mobile Agent Stream] tool/control event", event);
            },
            onError: callbacks.onError,
            onComplete: callbacks.onComplete,
          },
        );
      } else if (knowledgeBaseEnabled) {
        await streamRAG(
          {
            userId: user.id,
            query: messageText,
            model: selectedModel,
            conversationHistory: history,
            conversationId: conversationId ?? undefined,
            enableThinking,
            knowledgeBaseEnabled: true,
          },
          callbacks,
          { authToken, signal: abortController.signal },
        );
      } else {
        const chatMessages = buildMessages(messageText, history);
        await streamChat(
          chatMessages,
          selectedModel,
          enableThinking,
          callbacks,
          { authToken, signal: abortController.signal },
        );
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  }, [
    input,
    user,
    isSending,
    resetDraft,
    activeConversationId,
    createConversation,
    addMessage,
    updateConversationTitle,
    convexMessages,
    getToken,
    resumeCursor,
    addThinkingStep,
    selectedModel,
    enableThinking,
    knowledgeBaseEnabled,
  ]);

  const handleNewConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeInputRef.current = null;
    isCreatingNewRef.current = true;
    setActiveConversationId(null);
    setStatus("idle");
    setResumeCursor(null);
    setLastFailedInput(null);
    resetDraft();
  }, [resetDraft]);

  const handleSelectConversation = useCallback((id: Id<"aiConversations">) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeInputRef.current = null;
    isCreatingNewRef.current = false;
    setActiveConversationId(id);
    setStatus("idle");
    setResumeCursor(null);
    setLastFailedInput(null);
    resetDraft();
  }, [resetDraft]);

  const handleDeleteConversation = useCallback(async (id: Id<"aiConversations">) => {
    if (!user) return;

    try {
      await deleteConversation({ conversationId: id });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setStatus("idle");
        setResumeCursor(null);
        setLastFailedInput(null);
        resetDraft();
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  }, [activeConversationId, deleteConversation, resetDraft, user]);

  return {
    user,
    conversations,
    convexMessages,
    input,
    setInput,
    status,
    isSending,
    streamingContent,
    reasoningContent,
    completedReasoning,
    reasoningExpanded,
    setReasoningExpanded,
    activeConversationId,
    selectedModel,
    setSelectedModel,
    enableThinking,
    setEnableThinking,
    knowledgeBaseEnabled,
    setKnowledgeBaseEnabled,
    thinkingSteps,
    stepsExpanded,
    setStepsExpanded,
    lastFailedInput,
    resumeCursor,
    handleSend,
    handleStop,
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
  };
}
