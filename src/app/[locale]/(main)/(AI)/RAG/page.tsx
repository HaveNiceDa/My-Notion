"use client";

import { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";
import { useUser } from "@clerk/clerk-react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { runRAGQueryStream } from "@/src/lib/rag";
import { formatRelativeTime } from "@/src/lib/timeUtils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

// 初始化Convex客户端
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
}

const RAGPage = () => {
  const { user } = useUser();
  const t = useTranslations("RAG");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] =
    useState<Id<"ragConversations"> | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [showConversationList, setShowConversationList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 初始化对话和加载历史记录
  useEffect(() => {
    const initConversation = async () => {
      if (!user) return;

      try {
        // 加载所有对话
        await loadConversations();

        // 获取用户的最近对话
        const conversations = await convex.query(
          api.documents.getConversations,
          {
            userId: user.id,
          },
        );

        let newConversationId;
        if (conversations.length > 0) {
          // 使用最近的对话
          newConversationId = conversations[0]._id;
          // 加载对话历史
          const messages = await convex.query(api.documents.getMessages, {
            conversationId: newConversationId,
          });

          // 转换消息格式
          const formattedMessages: Message[] = messages.map((msg: any) => ({
            id: msg._id,
            content: msg.content,
            role: msg.role,
            timestamp: new Date(msg.createdAt),
          }));

          setMessages(formattedMessages);
        } else {
          // 创建新对话
          newConversationId = await convex.mutation(
            api.documents.createConversation,
            {
              userId: user.id,
              title: t("newConversation"),
            },
          );
        }

        setConversationId(newConversationId);
      } catch (error) {
        console.error("Error initializing conversation:", error);
      }
    };

    initConversation();
  }, [user]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user || !conversationId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // 创建一个临时的助手消息ID
    const assistantMessageId = (Date.now() + 1).toString();
    const tempAssistantMessage: Message = {
      id: assistantMessageId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, tempAssistantMessage]);

    try {
      // 保存用户消息到Convex
      await convex.mutation(api.documents.addMessage, {
        conversationId,
        content: input,
        role: "user" as "user" | "assistant",
      });

      // 构建对话历史消息数组
      const conversationHistoryMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // 执行RAG查询（流式输出）
      let currentContent = "";
      await runRAGQueryStream(
        user.id,
        input,
        conversationHistoryMessages, // 传递对话历史作为消息数组
        // onChunk - 处理每个数据块
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
        // onComplete - 完成时保存消息
        async () => {
          // 保存助手消息到Convex
          await convex.mutation(api.documents.addMessage, {
            conversationId,
            content: currentContent,
            role: "assistant" as "user" | "assistant",
          });
        },
        // onError - 错误处理
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
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 加载用户的所有对话
  const loadConversations = async () => {
    if (!user) return;

    try {
      setIsLoadingConversations(true);
      const result = await convex.query(api.documents.getConversations, {
        userId: user.id,
      });
      setConversations(result);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  // 创建新对话
  const createNewConversation = async () => {
    if (!user) return;

    try {
      const newConversationId = await convex.mutation(
        api.documents.createConversation,
        {
          userId: user.id,
          title: t("newConversation"),
        },
      );
      setConversationId(newConversationId);
      setMessages([]);
      await loadConversations();
    } catch (error) {
      console.error("Error creating new conversation:", error);
    }
  };

  // 加载特定对话
  const loadConversation = async (convId: Id<"ragConversations">) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setConversationId(convId);

      // 加载对话历史
      const messages = await convex.query(api.documents.getMessages, {
        conversationId: convId,
      });

      // 转换消息格式
      const formattedMessages: Message[] = messages.map((msg: any) => ({
        id: msg._id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.createdAt),
      }));

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // 删除对话
  const deleteConversation = async (convId: Id<"ragConversations">) => {
    if (!user) return;

    // 如果删除的是当前对话，显示提示并禁止删除
    if (conversationId === convId) {
      toast.error(t("cannotDeleteCurrentConversation"));
      return;
    }

    try {
      // 执行删除操作
      await convex.mutation(api.documents.deleteConversation, {
        conversationId: convId,
      });

      // 重新加载对话列表，确保数据同步
      await loadConversations();

      toast.success(t("conversationDeleted"));
    } catch (error) {
      console.error("Error deleting conversation:", error);
      toast.error(t("deleteFailed"));
      // 如果删除失败，重新加载对话列表恢复UI
      await loadConversations();
    }
  };

  if (!user) {
    return (
      <div className="px-4 py-8 flex items-center justify-center min-h-[80vh]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden p-8 text-center max-w-md w-full">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            {t("pleaseLoginFirst")}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t("loginToUseAIConversation")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-8 h-[90vh]">
      <div className="h-full bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden flex">
        {/* 对话记录侧边栏 */}
        <div
          className={`w-72 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ${showConversationList ? "block" : "hidden"}`}
        >
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t("aiConversation")}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowConversationList(false)}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-gray-600 dark:text-gray-300"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={createNewConversation}
                  size="sm"
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Input
              type="text"
              placeholder={t("searchOrStartNewConversation")}
              className="w-full"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-2">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">
              {t("past30Days")}
            </div>
            {isLoadingConversations ? (
              <div className="p-4 text-center text-gray-500">
                {t("loading")}
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                {t("noConversationRecords")}
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation._id}
                  className={`p-3 rounded-lg cursor-pointer mb-1 transition-colors ${conversationId === conversation._id ? "bg-purple-100 dark:bg-purple-900" : "hover:bg-gray-100 dark:hover:bg-gray-700"}`}
                  onClick={() => loadConversation(conversation._id)}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {conversation.title}
                    </p>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conversation._id);
                      }}
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(conversation.updatedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 对话主区域 */}
        <div className="flex-1 flex flex-col">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 px-6 flex items-center">
            <Button
              onClick={() => setShowConversationList(true)}
              size="sm"
              variant="ghost"
              className="mr-2 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-white" />
              <h1 className="text-xl font-semibold text-white">
                {t("aiConversation")}
              </h1>
            </div>
          </div>

          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "mb-4 flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    message.role === "user"
                      ? "bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-white rounded-br-none"
                      : "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-700",
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start mb-4">
                <div className="max-w-[80%] rounded-lg p-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none border border-gray-200 dark:border-gray-700">
                  <p className="text-sm">{t("thinking")}</p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <Input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t("pleaseEnterYourQuestion")}
                className="flex-1"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RAGPage;
