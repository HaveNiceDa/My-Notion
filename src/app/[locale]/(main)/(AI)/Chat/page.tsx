"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useUser } from "@clerk/clerk-react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
// 动态导入 RAG 相关功能，实现代码分割
type AIModel = "qwen-plus" | "qwen-max" | "qwen3-coder-plus";
type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

const runRAGQueryStream = async (
  userId: string,
  input: string,
  conversationHistoryMessages: any[],
  onChunk: (chunk: string) => void,
  onComplete: () => Promise<void>,
  onError: (error: any) => void,
  model: AIModel,
  temperature: number,
  searchType: RetrievalStrategy,
  k: number,
  knowledgeBaseEnabled: boolean,
  conversationId: string | Id<"aiConversations">,
) => {
  try {
    const { runRAGQueryStream: actualRunRAGQueryStream } =
      await import("@/src/lib/rag/rag");
    return await actualRunRAGQueryStream(
      userId,
      input,
      conversationHistoryMessages,
      onChunk,
      onComplete,
      onError,
      model,
      temperature,
      searchType,
      k,
      knowledgeBaseEnabled,
      conversationId as Id<"aiConversations">,
    );
  } catch (error) {
    console.error("Error loading RAG module:", error);
    onError(error);
  }
};
import { formatRelativeTime } from "@/src/lib/timeUtils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useAIModelStore } from "@/src/lib/store/use-ai-model-store";
import { useVectorStoreStore } from "@/src/lib/store/use-vector-store-store";
import { useKnowledgeBaseStore } from "@/src/lib/store/use-knowledge-base-store";
import { useThinkingProcessStore } from "@/src/lib/store/use-thinking-process-store";
import dynamic from "next/dynamic";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { TopNavigation } from "./components/TopNavigation";
import { NewConversationLanding } from "./components/NewConversationLanding";

import { MessageInput } from "./components/MessageInput";
const MessageList = dynamic(
  () =>
    import("./components/MessageList").then((module) => ({
      default: module.MessageList,
    })),
  {
    ssr: false,
    loading: () => <Skeleton className="flex-1 w-full" />,
  },
);
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// 请求缓存
interface RequestCache {
  conversations: Map<string, any[]>;
  messages: Map<string, any[]>;
}

const requestCache: RequestCache = {
  conversations: new Map<string, any[]>(),
  messages: new Map<string, any[]>(),
};

interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: Date;
}

const AIPage = () => {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const t = useTranslations("AI");
  const { model } = useAIModelStore();
  const { userLoadingStatus } = useVectorStoreStore();
  const { enabled: knowledgeBaseEnabled } = useKnowledgeBaseStore();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] =
    useState<Id<"aiConversations"> | null>(null);
  const [conversationCreatedAt, setConversationCreatedAt] =
    useState<Date | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const [isConversationListPinned, setIsConversationListPinned] =
    useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousSearchParamsIdRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const initConversation = async () => {
      if (!user) return;

      try {
        // 优先检查 URL 中是否有 conversationId
        const conversationIdFromUrl = searchParams.get("id");

        if (conversationIdFromUrl) {
          // 优先加载当前对话数据
          await loadConversation(
            conversationIdFromUrl as Id<"aiConversations">,
          );
        }

        // 延迟加载对话历史，非关键数据
        setTimeout(async () => {
          try {
            const loadedConversations = await convex.query(
              api.aiChat.getConversations,
              {
                userId: user.id,
              },
            );
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

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading || !user) return;

    // Check if vector store is still loading
    const vectorStoreStatus = userLoadingStatus[user.id];
    if (vectorStoreStatus === "loading") {
      toast.info(t("knowledgeBaseInitializing"));
      return;
    }

    let currentConversationId = conversationId;

    if (!currentConversationId) {
      try {
        currentConversationId = await convex.mutation(
          api.aiChat.createConversation,
          {
            userId: user.id,
            title: t("newConversation"),
          },
        );
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

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    const assistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      await convex.mutation(api.aiChat.addMessage, {
        conversationId: currentConversationId,
        content: input,
        role: "user" as "user" | "assistant",
      });

      const conversationHistoryMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // 清空并重新加载思考过程步骤，确保在RAG查询开始前显示
      if (currentConversationId) {
        const { clearSteps, loadSteps } = useThinkingProcessStore.getState();
        clearSteps();
        // 立即开始加载思考过程，不等待完成
        loadSteps(currentConversationId);
      }

      let currentContent = "";
      await runRAGQueryStream(
        user.id,
        input,
        conversationHistoryMessages,
        (chunk) => {
          currentContent += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? { ...msg, content: currentContent }
                : msg,
            ),
          );
        },
        async () => {
          await convex.mutation(api.aiChat.addMessage, {
            conversationId: currentConversationId,
            content: currentContent,
            role: "assistant" as "user" | "assistant",
          });

          await convex.mutation(api.aiChat.updateConversationTitle, {
            conversationId: currentConversationId,
            title: input.length > 50 ? input.substring(0, 50) + "..." : input,
          });

          await loadConversations();
        },
        (error) => {
          console.error("Error in RAG stream:", error);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    content: "Sorry, something went wrong. Please try again.",
                  }
                : msg,
            ),
          );
        },
        model,
        0.6,
        "hybrid" as RetrievalStrategy,
        0.5,
        knowledgeBaseEnabled,
        currentConversationId,
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    user,
    input,
    isLoading,
    conversationId,
    messages,
    model,
    knowledgeBaseEnabled,
    userLoadingStatus,
    t,
    router,
  ]);

  const loadConversations = useCallback(async () => {
    if (!user) return;

    try {
      // 检查缓存
      const cacheKey = user.id;
      if (requestCache.conversations.has(cacheKey)) {
        const cachedData = requestCache.conversations.get(cacheKey);
        if (cachedData) {
          setConversations(cachedData);
          return;
        }
      }

      setIsLoadingConversations(true);
      const result = await convex.query(api.aiChat.getConversations, {
        userId: user.id,
      });

      // 缓存结果
      requestCache.conversations.set(cacheKey, result);
      setConversations(result);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  }, [user]);

  const createNewConversation = useCallback(() => {
    router.push(pathname);
    setConversationId(null);
    setMessages([]);
    setConversationCreatedAt(null);
    previousSearchParamsIdRef.current = null;
    setShowConversationList(false);
  }, [router, pathname]);

  const loadConversation = useCallback(
    async (convId: Id<"aiConversations">) => {
      if (!user) return;

      try {
        setIsLoading(true);
        setConversationId(convId);
        previousSearchParamsIdRef.current = convId;

        router.push(`?id=${convId}`);

        // 检查缓存
        const cacheKey = convId;
        let messages: any[];

        if (requestCache.messages.has(cacheKey)) {
          const cachedMessages = requestCache.messages.get(cacheKey);
          messages = cachedMessages || [];
        } else {
          messages = await convex.query(api.aiChat.getMessages, {
            conversationId: convId,
          });
          // 缓存结果
          requestCache.messages.set(cacheKey, messages);
        }

        const formattedMessages: Message[] = messages.map((msg: any) => ({
          id: msg._id,
          content: msg.content,
          role: msg.role,
          timestamp: new Date(msg.createdAt),
        }));

        setMessages(formattedMessages);

        let conversation = conversations.find((conv) => conv._id === convId);
        if (!conversation) {
          const loadedConversations = await convex.query(
            api.aiChat.getConversations,
            {
              userId: user.id,
            },
          );
          setConversations(loadedConversations);
          conversation = loadedConversations.find(
            (conv) => conv._id === convId,
          );
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
    },
    [user, conversations, router],
  );

  const deleteConversation = useCallback(
    async (convId: Id<"aiConversations">) => {
      if (!user) return;

      if (conversationId === convId) {
        toast.error(t("cannotDeleteCurrentConversation"));
        return;
      }

      try {
        await convex.mutation(api.aiChat.deleteConversation, {
          conversationId: convId,
          userId: user.id,
        });

        // 清除对话列表缓存，确保获取最新数据
        requestCache.conversations.delete(user.id);

        await loadConversations();

        toast.success(t("conversationDeleted"));
      } catch (error) {
        console.error("Error deleting conversation:", error);
        toast.error(t("deleteFailed"));
        // 清除缓存并重新加载，确保数据一致性
        requestCache.conversations.delete(user.id);
        await loadConversations();
      }
    },
    [user, conversationId, t, loadConversations],
  );

  return (
    <div className="h-screen w-full">
      <div className="h-full w-full bg-background overflow-hidden relative">
        <ConversationSidebar
          show={showConversationList || isConversationListPinned}
          isPinned={isConversationListPinned}
          conversations={conversations}
          isLoading={isLoadingConversations}
          onClose={() =>
            !isConversationListPinned && setShowConversationList(false)
          }
          onPin={() => setIsConversationListPinned(!isConversationListPinned)}
          onNewConversation={createNewConversation}
          onSelectConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          currentConversationId={conversationId}
          formatRelativeTime={formatRelativeTime}
        />

        <div
          className="h-full w-full flex flex-col"
          onClick={() =>
            !isConversationListPinned &&
            showConversationList &&
            setShowConversationList(false)
          }
        >
          {!searchParams.get("id") ? (
            <div className="flex-1 flex flex-col bg-background">
              <TopNavigation
                onShowHistory={() => setShowConversationList(true)}
              />
              <NewConversationLanding
                input={input}
                onInputChange={setInput}
                onSend={handleSend}
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-full pb-4">
              <TopNavigation
                onShowHistory={() => setShowConversationList(true)}
              />
              <MessageList
                messages={messages}
                isLoading={isLoading}
                messagesEndRef={messagesEndRef}
                conversationCreatedAt={conversationCreatedAt}
                conversationId={conversationId}
              />
              <div className="w-full flex justify-center">
                <div className="w-[55%]">
                  <MessageInput
                    input={input}
                    onInputChange={setInput}
                    onSend={handleSend}
                    conversationId={conversationId}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIPage;
