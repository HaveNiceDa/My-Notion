import { useAuth, useUser } from "@clerk/expo";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  resumeAgentStream,
  streamAgent,
  type MobileAgentStreamCursor,
} from "@/lib/ai/agent-stream";
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
  AgentChatResumeSnapshot,
  AgentChatStatus,
  AgentToolEventItem,
  AgentToolEventSource,
  AgentToolStreamEvent,
  ThinkingStep,
} from "../types";

const MOBILE_AGENT_STREAM_ENABLED =
  process.env.EXPO_PUBLIC_MOBILE_AGENT_STREAM !== "0";
const RESUME_STORAGE_TTL_MS = 24 * 60 * 60 * 1000;

function getResumeStorageKey(userId: string) {
  return `@mynotion/mobile-agent-resume:${userId}`;
}

function isResumeSnapshot(value: unknown): value is AgentChatResumeSnapshot {
  if (!value || typeof value !== "object") return false;

  const snapshot = value as Partial<AgentChatResumeSnapshot>;
  return (
    typeof snapshot.conversationId === "string" &&
    typeof snapshot.content === "string" &&
    typeof snapshot.reasoning === "string" &&
    typeof snapshot.updatedAt === "number" &&
    !!snapshot.cursor &&
    typeof snapshot.cursor.runId === "string" &&
    typeof snapshot.cursor.assistantMessageId === "string" &&
    typeof snapshot.cursor.lastAppliedSeq === "number"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function compactToolDetail(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value) return "";

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeToolSources(value: unknown): AgentToolEventSource[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((source) => {
    if (!isRecord(source)) return [];
    if (
      source.type !== "document" &&
      source.type !== "web" &&
      source.type !== "memory"
    ) {
      return [];
    }

    return [{
      type: source.type,
      title: typeof source.title === "string" ? source.title : undefined,
      url: typeof source.url === "string" ? source.url : undefined,
      documentId: typeof source.documentId === "string" ? source.documentId : undefined,
      memoryId: typeof source.memoryId === "string" ? source.memoryId : undefined,
      score: typeof source.score === "number" ? source.score : undefined,
    }];
  });
}

function getToolResultState(result: unknown) {
  if (!isRecord(result)) {
    return {
      detail: compactToolDetail(result),
      sources: [] as AgentToolEventSource[],
      recoverable: true,
      hasError: false,
    };
  }

  const detail = typeof result.summary === "string"
    ? result.summary
    : typeof result.error === "string"
      ? result.error
      : compactToolDetail(result);

  return {
    detail,
    sources: normalizeToolSources(result.sources),
    recoverable: result.recoverable !== false,
    hasError: typeof result.error === "string",
  };
}

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
  const [toolEvents, setToolEvents] = useState<AgentToolEventItem[]>([]);
  const [stepsExpanded, setStepsExpanded] = useState(true);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [resumeCursor, setResumeCursor] =
    useState<MobileAgentStreamCursor | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isCreatingNewRef = useRef(false);
  const activeInputRef = useRef<string | null>(null);
  const resumeCursorRef = useRef<MobileAgentStreamCursor | null>(null);
  const resumeSnapshotRef = useRef<AgentChatResumeSnapshot | null>(null);

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

  useEffect(() => {
    resumeCursorRef.current = resumeCursor;
  }, [resumeCursor]);

  const clearResumeSnapshot = useCallback(async () => {
    if (!user) return;

    resumeCursorRef.current = null;
    resumeSnapshotRef.current = null;
    setResumeCursor(null);

    try {
      await AsyncStorage.removeItem(getResumeStorageKey(user.id));
    } catch (error) {
      console.error("Failed to clear mobile agent resume cursor:", error);
    }
  }, [user]);

  const persistResumeSnapshot = useCallback(async (
    snapshot: AgentChatResumeSnapshot,
  ) => {
    if (!user) return;

    resumeCursorRef.current = snapshot.cursor;
    resumeSnapshotRef.current = snapshot;
    setResumeCursor(snapshot.cursor);

    try {
      await AsyncStorage.setItem(
        getResumeStorageKey(user.id),
        JSON.stringify(snapshot),
      );
    } catch (error) {
      console.error("Failed to persist mobile agent resume cursor:", error);
    }
  }, [user]);

  const addThinkingStep = useCallback(
    (type: string, content: string, details?: string) => {
      setThinkingSteps((steps) => [...steps, { type, content, details }]);
    },
    [],
  );

  const clearThinkingSteps = useCallback(() => {
    setThinkingSteps([]);
  }, []);

  const clearToolEvents = useCallback(() => {
    setToolEvents([]);
  }, []);

  const recordToolEvent = useCallback((event: AgentToolStreamEvent) => {
    setToolEvents((items) => {
      const current = items.find((item) => item.id === event.toolCallId);
      const resultState = "result" in event
        ? getToolResultState(event.result)
        : null;
      const nextStatus: AgentToolEventItem["status"] =
        event.type === "tool-call-result"
          ? resultState?.hasError
            ? "failed"
            : "completed"
          : "running";
      const detail = resultState
        ? resultState.detail
        : compactToolDetail("delta" in event ? event.delta : undefined);
      const toolName = "toolName" in event ? event.toolName : undefined;
      const nextItem: AgentToolEventItem = {
        id: event.toolCallId,
        name: toolName || current?.name || "tool",
        status: nextStatus,
        detail: detail || current?.detail || "",
        sources: resultState?.sources ?? current?.sources ?? [],
        recoverable: resultState?.recoverable ?? current?.recoverable ?? true,
        updatedAt: Date.now(),
      };

      if (!current) {
        return [...items, nextItem];
      }

      return items.map((item) =>
        item.id === event.toolCallId ? nextItem : item,
      );
    });
  }, []);

  const resetDraft = useCallback(() => {
    setStreamingContent("");
    setReasoningContent("");
    setCompletedReasoning("");
    clearThinkingSteps();
    clearToolEvents();
  }, [clearThinkingSteps, clearToolEvents]);

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

  useEffect(() => {
    if (!visible || !user || isSending || resumeSnapshotRef.current) return;

    const loadResumeSnapshot = async () => {
      try {
        const raw = await AsyncStorage.getItem(getResumeStorageKey(user.id));
        if (!raw) return;

        const parsed: unknown = JSON.parse(raw);
        if (
          !isResumeSnapshot(parsed) ||
          Date.now() - parsed.updatedAt > RESUME_STORAGE_TTL_MS
        ) {
          await AsyncStorage.removeItem(getResumeStorageKey(user.id));
          return;
        }

        resumeSnapshotRef.current = parsed;
        resumeCursorRef.current = parsed.cursor;
        setResumeCursor(parsed.cursor);
        setActiveConversationId(parsed.conversationId);
        setStreamingContent(parsed.content);
        setCompletedReasoning(parsed.reasoning);
        setReasoningContent("");
        setStatus("resumable");
      } catch (error) {
        console.error("Failed to load mobile agent resume cursor:", error);
      }
    };

    void loadResumeSnapshot();
  }, [isSending, user, visible]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus(resumeCursorRef.current ? "resumable" : "failed");
    setLastFailedInput(activeInputRef.current);
  }, []);

  const handleSend = useCallback(async (retryInput?: string) => {
    const messageText = retryInput ?? input.trim();
    if (!messageText || !user || isSending) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    activeInputRef.current = messageText;

    setStatus("preparing");
    setLastFailedInput(null);
    await clearResumeSnapshot();
    isCreatingNewRef.current = false;
    if (!retryInput) setInput("");
    resetDraft();

    let fullContent = "";
    let fullReasoning = "";
    let conversationId = activeConversationId;

    const fail = (error: Error) => {
      if (abortController.signal.aborted) {
        setStatus(resumeCursorRef.current ? "resumable" : "failed");
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

      const saveResumeSnapshot = (cursor: MobileAgentStreamCursor) => {
        if (!conversationId) return;

        void persistResumeSnapshot({
          cursor,
          conversationId,
          content: fullContent,
          reasoning: fullReasoning,
          updatedAt: Date.now(),
        });
      };

      const callbacks = {
        onContent: (text: string) => {
          fullContent += text;
          setStreamingContent(fullContent);
          if (resumeCursorRef.current) {
            saveResumeSnapshot(resumeCursorRef.current);
          }
        },
        onReasoning: (text: string) => {
          fullReasoning += text;
          setReasoningContent(fullReasoning);
          setReasoningExpanded(true);
          if (resumeCursorRef.current) {
            saveResumeSnapshot(resumeCursorRef.current);
          }
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
          await clearResumeSnapshot();
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
            knowledgeBaseEnabled,
            currentDocument: null,
            authToken,
            signal: abortController.signal,
          },
          {
            onRunStart: (cursor) => {
              saveResumeSnapshot(cursor);
              console.log("[Mobile Agent Stream] run started", cursor.runId);
            },
            onCheckpoint: (cursor, checkpointKind) => {
              saveResumeSnapshot(cursor);
              console.log(
                "[Mobile Agent Stream] checkpoint",
                checkpointKind,
                cursor.lastAppliedSeq,
              );
            },
            onTextDelta: callbacks.onContent,
            onReasoningDelta: callbacks.onReasoning,
            onToolEvent: (event) => {
              if ("toolCallId" in event) {
                recordToolEvent(event);
              }
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
    clearResumeSnapshot,
    activeConversationId,
    createConversation,
    addMessage,
    updateConversationTitle,
    convexMessages,
    getToken,
    persistResumeSnapshot,
    addThinkingStep,
    recordToolEvent,
    selectedModel,
    enableThinking,
    knowledgeBaseEnabled,
  ]);

  const handleResume = useCallback(async () => {
    const snapshot = resumeSnapshotRef.current;
    if (!snapshot || !user || isSending) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    activeInputRef.current = null;

    let fullContent = snapshot.content;
    let fullReasoning = snapshot.reasoning;

    setStatus("streaming");
    setLastFailedInput(null);
    setActiveConversationId(snapshot.conversationId);
    setStreamingContent(fullContent);
    setCompletedReasoning(fullReasoning);
    setReasoningContent("");

    const saveResumeSnapshot = (cursor: MobileAgentStreamCursor) => {
      void persistResumeSnapshot({
        cursor,
        conversationId: snapshot.conversationId,
        content: fullContent,
        reasoning: fullReasoning,
        updatedAt: Date.now(),
      });
    };

    const fail = (error: Error) => {
      if (abortController.signal.aborted) {
        setStatus(resumeCursorRef.current ? "resumable" : "failed");
        return;
      }

      console.error("AI resume stream error:", error);
      setStatus("resumable");
    };

    try {
      const authToken = await getToken();

      await resumeAgentStream(
        {
          cursor: snapshot.cursor,
          authToken,
          signal: abortController.signal,
        },
        {
          onCheckpoint: (cursor) => {
            saveResumeSnapshot(cursor);
          },
          onTextDelta: (delta) => {
            fullContent += delta;
            setStreamingContent(fullContent);
            if (resumeCursorRef.current) {
              saveResumeSnapshot(resumeCursorRef.current);
            }
          },
          onReasoningDelta: (delta) => {
            fullReasoning += delta;
            setReasoningContent(fullReasoning);
            setReasoningExpanded(true);
            if (resumeCursorRef.current) {
              saveResumeSnapshot(resumeCursorRef.current);
            }
          },
          onToolEvent: (event) => {
            if ("toolCallId" in event) {
              recordToolEvent(event);
            }
            console.log("[Mobile Agent Stream] resume tool/control event", event);
          },
          onError: fail,
          onComplete: async () => {
            if (abortController.signal.aborted) return;

            if (fullReasoning) {
              setCompletedReasoning(fullReasoning);
              setReasoningContent("");
              setReasoningExpanded(false);
            }
            if (fullContent) {
              try {
                await addMessage({
                  conversationId: snapshot.conversationId,
                  content: fullContent,
                  role: "assistant",
                });
              } catch (error) {
                console.error("Failed to save resumed assistant message:", error);
              }
            }
            setStreamingContent("");
            setStatus("done");
            abortControllerRef.current = null;
            activeInputRef.current = null;
            await clearResumeSnapshot();
          },
        },
      );
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  }, [
    addMessage,
    clearResumeSnapshot,
    getToken,
    isSending,
    persistResumeSnapshot,
    recordToolEvent,
    user,
  ]);

  const handleNewConversation = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeInputRef.current = null;
    isCreatingNewRef.current = true;
    setActiveConversationId(null);
    setStatus("idle");
    void clearResumeSnapshot();
    setLastFailedInput(null);
    resetDraft();
  }, [clearResumeSnapshot, resetDraft]);

  const handleSelectConversation = useCallback((id: Id<"aiConversations">) => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeInputRef.current = null;
    isCreatingNewRef.current = false;
    setActiveConversationId(id);
    setStatus("idle");
    void clearResumeSnapshot();
    setLastFailedInput(null);
    resetDraft();
  }, [clearResumeSnapshot, resetDraft]);

  const handleDeleteConversation = useCallback(async (id: Id<"aiConversations">) => {
    if (!user) return;

    try {
      await deleteConversation({ conversationId: id });
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setStatus("idle");
        void clearResumeSnapshot();
        setLastFailedInput(null);
        resetDraft();
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  }, [activeConversationId, clearResumeSnapshot, deleteConversation, resetDraft, user]);

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
    toolEvents,
    stepsExpanded,
    setStepsExpanded,
    lastFailedInput,
    resumeCursor,
    handleSend,
    handleResume,
    handleStop,
    handleNewConversation,
    handleSelectConversation,
    handleDeleteConversation,
  };
}
