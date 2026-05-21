"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { devLog } from "@notion/business/utils";
import type { ChatMessage, Conversation, ToolCall, SendMessageOptions } from "./types";
import type { AIModelId, ChatMode } from "./models";
import { getInitialAIModelId } from "./models";

async function runRAGStream(
  userId: string,
  input: string,
  conversationHistoryMessages: unknown[],
  onChunk: (chunk: string) => void,
  onReasoningChunk: (chunk: string) => void,
  onComplete: () => Promise<void>,
  onError: (error: unknown) => void,
  model: AIModelId,
  mode: ChatMode,
  conversationId: string,
  enableThinking: boolean,
) {
  try {
    const response = await fetch("/api/rag-stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "runRAGQueryStream",
        userId,
        query: input,
        conversationHistory: conversationHistoryMessages,
        model,
        minScore: 0.6,
        knowledgeBaseEnabled: mode === "rag",
        conversationId,
        enableThinking,
      }),
    });

    if (!response.ok) {
      throw new Error(`RAG stream failed: ${response.statusText}`);
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
                case "error":
                  if (parsedData.message === "terminated") {
                    devLog("[RAG] 连接正常终止");
                  } else {
                    onError(new Error(parsedData.message));
                  }
                  break;
                case "done":
                  devLog("[RAG] 接收到结束事件");
                  break;
              }
            } catch (error) {
              console.error("[RAG] 解析 SSE 数据出错:", error);
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
    onError(error);
  }
}

export function useAIChat() {
  const { user } = useUser();
  const convex = useConvex();
  const t = useTranslations("AI");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<Date | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [modelId, setModelIdState] = useState<AIModelId>(getInitialAIModelId);
  const [mode, setModeState] = useState<ChatMode>("chat");
  const [enableThinking, setEnableThinking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const setModelId = useCallback((id: AIModelId) => {
    setModelIdState(id);
    localStorage.setItem("ai-model-id", id);
  }, []);

  const setMode = useCallback((m: ChatMode) => {
    setModeState(m);
  }, []);

  const toggleThinking = useCallback(() => {
    setEnableThinking((prev) => !prev);
  }, []);

  const loadConversations = useMemoizedFn(async () => {
    if (!user) return;
    try {
      setIsLoadingConversations(true);
      const result = await convex.query(api.aiChat.getConversations, {});
      setConversations(result as Conversation[]);
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

      const msgs = await convex.query(api.aiChat.getMessages, { conversationId: convId });
      const formattedMessages: ChatMessage[] = msgs.map((msg: any) => {
        let content = msg.content;
        let reasoningContent: string | undefined;
        try {
          const parsedContent = JSON.parse(msg.content);
          if (parsedContent.content !== undefined) {
            content = parsedContent.content;
            reasoningContent = parsedContent.reasoningContent;
          }
        } catch {}
        return {
          id: msg._id,
          content,
          reasoningContent,
          role: msg.role,
          timestamp: new Date(msg.createdAt),
        };
      });
      setMessages(formattedMessages);

      let conversation = conversations.find((conv) => conv._id === convId);
      if (!conversation) {
        const loadedConversations = await convex.query(api.aiChat.getConversations, {});
        setConversations(loadedConversations as Conversation[]);
        conversation = (loadedConversations as Conversation[]).find((conv) => conv._id === convId);
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
    if (!user) return;
    if (conversationId === convId) {
      toast.error(t("cannotDeleteCurrentConversation"));
      return;
    }
    try {
      await convex.mutation(api.aiChat.deleteConversation, { conversationId: convId });
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

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      try {
        currentConversationId = await convex.mutation(api.aiChat.createConversation, {
          title: t("newConversation"),
        });
        setConversationId(currentConversationId);
        setConversationCreatedAt(new Date());
        await loadConversations();
      } catch (error) {
        console.error("Error creating conversation:", error);
        toast.error("创建对话失败，请重试");
        return;
      }
    }

    const messageContent = { text: input, images };
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: JSON.stringify(messageContent),
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setUploadedImages([]);
    setIsLoading(true);
    setToolCalls([]);

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

      await runRAGStream(
        user.id,
        input,
        conversationHistoryMessages,
        (chunk) => { currentContent += chunk; scheduleRender(); },
        (chunk) => { if (enableThinking) { currentReasoningContent += chunk; scheduleRender(); } },
        async () => {
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
          try {
            await convex.mutation(api.aiChat.addMessage, {
              conversationId: currentConversationId!,
              content: JSON.stringify(messageData),
              role: "assistant" as "user" | "assistant",
            });
            await convex.mutation(api.aiChat.updateConversationTitle, {
              conversationId: currentConversationId!,
              title: input.length > 50 ? input.substring(0, 50) + "..." : input || "图片对话",
            });
            await loadConversations();
          } catch (err) {
            console.error("[Chat] Failed to save message to Convex:", err);
          }
        },
        (error: unknown) => {
          console.error("Error in RAG stream:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: "Sorry, something went wrong. Please try again." }
                : msg,
            ),
          );
        },
        modelId,
        mode,
        currentConversationId!,
        enableThinking,
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
    if (!user) return;
    const init = async () => {
      try {
        const loadedConversations = await convex.query(api.aiChat.getConversations, {});
        setConversations(loadedConversations as Conversation[]);
      } catch (error) {
        console.error("Error loading conversations:", error);
      }
    };
    init();
  }, [user]);

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
    mode,
    setMode,
    enableThinking,
    toggleThinking,
    toolCalls,
    uploadedImages,
    setUploadedImages,
    sendMessage,
    handleGetImages,
    createNewConversation,
    loadConversation,
    deleteConversation,
    loadConversations,
  };
}
