"use client";

import { useState, useCallback, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useUser } from "@clerk/nextjs";
import { useConvex } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { devLog } from "@notion/business/utils";
import { useCurrentDocumentStore } from "@/src/lib/store/use-current-document-store";
import type { CurrentDocumentContext } from "@/src/lib/store/use-current-document-store";
import type { AgentStreamEvent, ChatMessage, Conversation, ToolCall } from "./types";
import type { AIModelId } from "./models";
import { getInitialAIModelId } from "./models";

async function runAgentStream(
  conversationHistoryMessages: unknown[],
  onChunk: (chunk: string) => void,
  onReasoningChunk: (chunk: string) => void,
  onToolCallStart: (toolCallId: string, toolName: string) => void,
  onToolCallDelta: (toolCallId: string, delta: string) => void,
  onToolCallResult: (toolCallId: string, result: unknown) => void,
  onComplete: () => Promise<void>,
  onError: (error: unknown) => void,
  model: AIModelId,
  conversationId: string,
  enableThinking: boolean,
  currentDocument: CurrentDocumentContext | null,
) {
  try {
    const response = await fetch("/api/agent/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversationHistoryMessages,
        modelId: model,
        conversationId,
        enableThinking,
        currentDocument,
      }),
    });

    if (!response.ok) {
      throw new Error(`Agent stream failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let streamFailed = false;

    function handleEvent(event: AgentStreamEvent) {
      switch (event.type) {
        case "text-delta":
          onChunk(event.delta);
          break;
        case "reasoning-delta":
          onReasoningChunk(event.delta);
          break;
        case "tool-call-start":
          onToolCallStart(event.toolCallId, event.toolName);
          break;
        case "tool-call-delta":
          onToolCallDelta(event.toolCallId, event.delta);
          break;
        case "tool-call-result":
          onToolCallResult(event.toolCallId, event.result);
          break;
        case "error":
          streamFailed = true;
          onError(new Error(event.message));
          break;
        case "finish":
          devLog("[Agent] 接收到结束事件");
          break;
      }
    }

    function processBuffer(isFinal: boolean = false) {
      const lines = buffer.split("\n");
      const endIdx = isFinal ? lines.length : lines.length - 1;

      for (let i = 0; i < endIdx; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          handleEvent(JSON.parse(line) as AgentStreamEvent);
        } catch (error) {
          console.error("[Agent] 解析流式事件出错:", error);
        }
      }
      buffer = isFinal ? "" : lines[lines.length - 1];
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim()) processBuffer(true);
          if (!streamFailed) {
            await onComplete();
          }
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
  const currentDocument = useCurrentDocumentStore((state) => state.currentDocument);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<Id<"aiConversations"> | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] = useState<Date | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [modelId, setModelIdState] = useState<AIModelId>(getInitialAIModelId);
  const [enableThinking, setEnableThinking] = useState(false);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);

  const setModelId = useCallback((id: AIModelId) => {
    setModelIdState(id);
    localStorage.setItem("ai-model-id", id);
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
          } else if (typeof parsedContent.text === "string") {
            return { role: msg.role, content: parsedContent.text };
          } else {
            return { role: msg.role, content: msg.content };
          }
        } catch {
          return { role: msg.role, content: msg.content };
        }
      });

      // 当前用户消息不在 messages state 中（setMessages 是异步的），需要单独添加
      const currentMessageContent = [
        { type: "text", text: input || "" },
        ...images.map((image) => ({ type: "image_url", image_url: { url: image } })),
      ];
      conversationHistoryMessages.push({ role: "user", content: currentMessageContent });

      await runAgentStream(
        conversationHistoryMessages,
        (chunk: string) => { currentContent += chunk; scheduleRender(); },
        (chunk: string) => { if (enableThinking) { currentReasoningContent += chunk; scheduleRender(); } },
        (toolCallId: string, toolName: string) => {
          setToolCalls((prev) => [
            ...prev.filter((toolCall) => toolCall.id !== toolCallId),
            {
              id: toolCallId,
              name: toolName,
              parameters: {},
              status: "calling",
            },
          ]);
        },
        (toolCallId: string, delta: string) => {
          setToolCalls((prev) =>
            prev.map((toolCall) =>
              toolCall.id === toolCallId
                ? {
                    ...toolCall,
                    parameters: {
                      ...toolCall.parameters,
                      arguments: `${toolCall.parameters.arguments ?? ""}${delta}`,
                    },
                    status: "executing",
                  }
                : toolCall,
            ),
          );
        },
        (toolCallId: string, result: unknown) => {
          setToolCalls((prev) =>
            prev.map((toolCall) =>
              toolCall.id === toolCallId
                ? { ...toolCall, result, status: "completed" }
                : toolCall,
            ),
          );
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
        currentConversationId!,
        enableThinking,
        currentDocument,
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
