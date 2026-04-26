"use client";

import { useState, useRef, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { type AIModel } from "@notion/ai/config";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAIModelStore } from "@/src/lib/store/use-ai-model-store";
import { useVectorStoreStore } from "@/src/lib/store/use-vector-store-store";
import { useKnowledgeBaseStore } from "@/src/lib/store/use-knowledge-base-store";
import { useThinkingProcessStore } from "@/src/lib/store/use-thinking-process-store";
import { useDeepThinkingStore } from "@/src/lib/store/use-deep-thinking-store";
import { useToolCallStore } from "@/src/lib/store/use-tool-call-store";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface Message {
  id: string;
  content: string;
  reasoningContent?: string;
  role: string;
  timestamp: Date;
}

async function runRAGQueryStream(
  userId: string,
  input: string,
  conversationHistoryMessages: any[],
  onChunk: (chunk: string) => void,
  onReasoningChunk: (chunk: string) => void,
  onToolCall: (data: any) => void,
  onComplete: () => Promise<void>,
  onError: (error: any) => void,
  model: AIModel,
  temperature: number,
  knowledgeBaseEnabled: boolean,
  conversationId: string | Id<"aiConversations">,
  enableThinking: boolean,
) {
  try {
    if (conversationId) {
      const { clearSteps } = useThinkingProcessStore.getState();
      clearSteps();
    }

    const response = await fetch("/api/rag-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "runRAGQueryStream",
        userId,
        query: input,
        conversationHistory: conversationHistoryMessages,
        model,
        minScore: temperature,
        knowledgeBaseEnabled,
        conversationId,
        enableThinking,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to get RAG response: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    function processBuffer(isFinal: boolean = false) {
      const lines = buffer.split("\n");
      const endIdx = isFinal ? lines.length : lines.length - 1;

      for (let i = 0; i < endIdx; i++) {
        const line = lines[i];
        if (line.startsWith("event: ")) {
          const eventType = line.substring(7).trim();
          const dataLine = lines[i + 1];
          if (dataLine && dataLine.startsWith("data: ")) {
            const data = dataLine.substring(6);
            try {
              const parsedData = JSON.parse(data);
              switch (eventType) {
                case "content":
                  if (parsedData.text) onChunk(parsedData.text);
                  break;
                case "reasoning":
                  if (parsedData.text) onReasoningChunk(parsedData.text);
                  break;
                case "thinking_step":
                  if (conversationId) {
                    const { addStep } = useThinkingProcessStore.getState();
                    addStep(parsedData.step_type, parsedData.content, parsedData.details);
                  }
                  break;
                case "tool_call_start":
                case "tool_executing":
                case "tool_result":
                  onToolCall(parsedData);
                  break;
                case "error":
                  if (parsedData.message === "terminated") {
                    console.log("[RAG System] 连接正常终止");
                  } else {
                    onError(new Error(parsedData.message));
                  }
                  break;
                case "done":
                  console.log("[RAG System] 接收到结束事件");
                  break;
              }
            } catch (error) {
              console.error("[RAG System] 解析SSE数据出错:", error);
            }
          }
        }
      }
      buffer = isFinal ? "" : lines[lines.length - 1];
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processBuffer(true);
          await onComplete();
          break;
        }
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;
        processBuffer(false);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("Error in RAG API call:", error);
    onError(error);
  }
}

export function useAIChat() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations("AI");
  const { model } = useAIModelStore();
  const { userLoadingStatus } = useVectorStoreStore();
  const { enabled: knowledgeBaseEnabled } = useKnowledgeBaseStore();
  const { enabled: deepThinkingEnabled } = useDeepThinkingStore();
  const { clearSteps } = useThinkingProcessStore();
  const { addToolCall, setToolCallResult, setToolCallError } = useToolCallStore();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<Date | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [isConversationListPinned, setIsConversationListPinned] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const previousSearchParamsIdRef = useRef<string | null>(null);

  const loadConversations = useMemoizedFn(async () => {
    if (!user) return;
    try {
      setIsLoadingConversations(true);
      const result = await convex.query(api.aiChat.getConversations, { userId: user.id });
      setConversations(result);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  });

  const loadConversation = useMemoizedFn(async (convId: Id<"aiConversations">) => {
    if (!user) return;
    try {
      setIsLoading(true);
      setConversationId(convId);
      previousSearchParamsIdRef.current = convId;
      router.push(`?id=${convId}`);

      const msgs = await convex.query(api.aiChat.getMessages, { conversationId: convId });
      const formattedMessages: Message[] = msgs.map((msg: any) => {
        let content = msg.content;
        let reasoningContent: string | undefined;
        try {
          const parsedContent = JSON.parse(msg.content);
          if (parsedContent.content !== undefined) {
            content = parsedContent.content;
            reasoningContent = parsedContent.reasoningContent;
          }
        } catch {}
        return { id: msg._id, content, reasoningContent, role: msg.role, timestamp: new Date(msg.createdAt) };
      });
      setMessages(formattedMessages);

      let conversation = conversations.find((conv) => conv._id === convId);
      if (!conversation) {
        const loadedConversations = await convex.query(api.aiChat.getConversations, { userId: user.id });
        setConversations(loadedConversations);
        conversation = loadedConversations.find((conv: any) => conv._id === convId);
      }
      if (conversation) {
        setConversationCreatedAt(new Date(conversation.createdAt));
      }
      setShowConversationList(false);
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoading(false);
    }
  });

  const createNewConversation = useMemoizedFn(() => {
    router.push(pathname);
    setConversationId(null);
    setMessages([]);
    setConversationCreatedAt(null);
    previousSearchParamsIdRef.current = null;
    setShowConversationList(false);
  });

  const deleteConversation = useMemoizedFn(async (convId: Id<"aiConversations">) => {
    if (!user) return;
    if (conversationId === convId) {
      toast.error(t("cannotDeleteCurrentConversation"));
      return;
    }
    try {
      await convex.mutation(api.aiChat.deleteConversation, { conversationId: convId, userId: user.id });
      await loadConversations();
      toast.success(t("conversationDeleted"));
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error(t("deleteFailed"));
      await loadConversations();
    }
  });

  const handleGetImages = useMemoizedFn(() => uploadedImages);

  const sendMessage = useMemoizedFn(async (images: string[] = []) => {
    if ((!input.trim() && images.length === 0) || isLoading || !user) return;

    const vectorStoreStatus = userLoadingStatus[user.id];
    if (vectorStoreStatus === "loading") {
      toast.info(t("knowledgeBaseInitializing"));
      return;
    }

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      try {
        currentConversationId = await convex.mutation(api.aiChat.createConversation, {
          userId: user.id,
          title: t("newConversation"),
        });
        setConversationId(currentConversationId);
        setConversationCreatedAt(new Date());
        previousSearchParamsIdRef.current = currentConversationId;
        await loadConversations();
        router.push(`?id=${currentConversationId}`);
      } catch (error) {
        console.error("Error creating conversation:", error);
        toast.error("创建对话失败，请重试");
        return;
      }
    }

    const messageContent = { text: input, images };
    const userMessage: Message = {
      id: Date.now().toString(),
      content: JSON.stringify(messageContent),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setUploadedImages([]);
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: Message = {
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
      await convex.mutation(api.aiChat.addMessage, {
        conversationId: currentConversationId,
        content: JSON.stringify(messageContent),
        role: "user" as "user" | "assistant",
      });

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
          } else {
            return { role: msg.role, content: msg.content };
          }
        } catch {
          return { role: msg.role, content: msg.content };
        }
      });

      const currentMessageContent = [
        { type: "text", text: input || "" },
        ...images.map((image) => ({ type: "image_url", image_url: { url: image } })),
      ];
      conversationHistoryMessages.push({ role: "user", content: currentMessageContent });

      if (currentConversationId) {
        clearSteps();
      }

      await runRAGQueryStream(
        user.id,
        input,
        conversationHistoryMessages,
        (chunk) => { currentContent += chunk; scheduleRender(); },
        (chunk) => { if (deepThinkingEnabled) { currentReasoningContent += chunk; scheduleRender(); } },
        (data: any) => {
          if (!data) return;
          if (!data.type) return;
          switch (data.type) {
            case "tool_call_start":
              if (data.tool_calls && Array.isArray(data.tool_calls)) {
                data.tool_calls.forEach((toolCall: any) => {
                  const toolCallId = toolCall.id || `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  addToolCall({
                    id: toolCallId,
                    name: toolCall.function?.name || "unknown",
                    parameters: toolCall.function?.arguments ? JSON.parse(toolCall.function.arguments) : {},
                    status: "calling",
                  });
                });
              }
              break;
            case "tool_executing":
              addToolCall({
                id: `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: data.tool_name || "unknown",
                parameters: data.tool_args || {},
                status: "executing",
              });
              break;
            case "tool_result":
              const resultToolCallId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              addToolCall({ id: resultToolCallId, name: data.tool_name || "unknown", parameters: {}, status: "completed" });
              setToolCallResult(resultToolCallId, data.result);
              break;
            case "tool_error":
              const errorToolCallId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              addToolCall({ id: errorToolCallId, name: data.tool_name || "unknown", parameters: {}, status: "error" });
              setToolCallError(errorToolCallId, data.error);
              break;
          }
        },
        async () => {
          pendingRender = false;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent, reasoningContent: currentReasoningContent || undefined }
                : msg,
            ),
          );
          const messageData: any = { content: currentContent };
          if (deepThinkingEnabled && currentReasoningContent) {
            messageData.reasoningContent = currentReasoningContent;
          }
          try {
            await convex.mutation(api.aiChat.addMessage, {
              conversationId: currentConversationId,
              content: JSON.stringify(messageData),
              role: "assistant" as "user" | "assistant",
            });
            await convex.mutation(api.aiChat.updateConversationTitle, {
              conversationId: currentConversationId,
              title: input.length > 50 ? input.substring(0, 50) + "..." : input || "图片对话",
            });
            await loadConversations();
          } catch (err) {
            console.error("[Chat] Failed to save message to Convex:", err);
          }
        },
        (error: any) => {
          console.error("Error in RAG stream:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: "Sorry, something went wrong. Please try again." }
                : msg,
            ),
          );
        },
        model,
        0.6,
        knowledgeBaseEnabled,
        currentConversationId!,
        deepThinkingEnabled,
      );
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
    const initConversation = async () => {
      if (!user) return;
      try {
        const conversationIdFromUrl = searchParams.get("id");
        if (conversationIdFromUrl) {
          await loadConversation(conversationIdFromUrl as Id<"aiConversations">);
        }
        setTimeout(async () => {
          try {
            const loadedConversations = await convex.query(api.aiChat.getConversations, { userId: user.id });
            setConversations(loadedConversations);
          } catch (error) {
            console.error("Error loading conversations:", error);
          }
        }, 500);
        previousSearchParamsIdRef.current = conversationIdFromUrl;
      } catch (error) {
        console.error("Error initializing conversation:", error);
      }
    };
    initConversation();
  }, [user]);

  useEffect(() => {
    const currentId = searchParams.get("id");
    const previousId = previousSearchParamsIdRef.current;
    if (currentId !== previousId) {
      previousSearchParamsIdRef.current = currentId;
      if (currentId) {
        loadConversation(currentId as Id<"aiConversations">);
      } else if (previousId) {
        setConversationId(null);
        setMessages([]);
        setConversationCreatedAt(null);
      }
    }
  }, [searchParams.get("id")]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    conversationId,
    conversationCreatedAt,
    conversations,
    isLoadingConversations,
    showConversationList,
    setShowConversationList,
    isConversationListPinned,
    setIsConversationListPinned,
    uploadedImages,
    setUploadedImages,
    sendMessage,
    handleGetImages,
    createNewConversation,
    loadConversation,
    deleteConversation,
  };
}
