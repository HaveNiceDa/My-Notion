"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  MessageSquare,
  Send,
  Plus,
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  Settings,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
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
  role: string;
  timestamp: Date;
}

const RAGPage = () => {
  const { user } = useUser();
  const t = useTranslations("RAG");
  const router = useRouter();
  const params = useParams();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] =
    useState<Id<"ragConversations"> | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [showConversationList, setShowConversationList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        // 加载对话列表
        const loadedConversations = await convex.query(
          api.documents.getConversations,
          {
            userId: user.id,
          },
        );
        setConversations(loadedConversations);

        // 检查URL中是否有对话ID
        const urlParams = new URLSearchParams(window.location.search);
        const conversationIdFromUrl = urlParams.get("id");

        if (conversationIdFromUrl) {
          // 加载指定的对话
          await loadConversation(
            conversationIdFromUrl as Id<"ragConversations">,
          );
        }
      } catch (error) {
        console.error("Error initializing conversation:", error);
      }
    };

    initConversation();
  }, [user]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !user) return;

    let currentConversationId = conversationId;

    // 如果没有对话ID，创建新对话
    if (!currentConversationId) {
      try {
        currentConversationId = await convex.mutation(
          api.documents.createConversation,
          {
            userId: user.id,
            title: t("newConversation"),
          },
        );
        setConversationId(currentConversationId);

        // 更新URL，添加对话ID
        const url = new URL(window.location.href);
        url.searchParams.set("id", currentConversationId);
        window.history.pushState({}, "", url.toString());
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
        conversationId: currentConversationId,
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
            conversationId: currentConversationId,
            content: currentContent,
            role: "assistant" as "user" | "assistant",
          });

          // 更新对话标题
          await convex.mutation(api.documents.updateConversationTitle, {
            conversationId: currentConversationId,
            title: input.length > 50 ? input.substring(0, 50) + "..." : input,
          });

          // 重新加载对话列表
          await loadConversations();
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

  // 创建新对话 - 跳转到RAG首页
  const createNewConversation = () => {
    // 清除URL中的对话ID，返回首页
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.pushState({}, "", url.toString());

    // 重置状态
    setConversationId(null);
    setMessages([]);
  };

  // 加载特定对话
  const loadConversation = async (convId: Id<"ragConversations">) => {
    if (!user) return;

    try {
      setIsLoading(true);
      setConversationId(convId);

      // 更新URL，添加对话ID
      const url = new URL(window.location.href);
      url.searchParams.set("id", convId);
      window.history.pushState({}, "", url.toString());

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
      setShowConversationList(false);
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

  // 格式化当前日期
  const formatCurrentDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      month: "numeric",
      day: "numeric",
      weekday: "long",
    };
    return now.toLocaleDateString("zh-CN", options);
  };

  return (
    <div className="h-screen w-full">
      <div className="h-full w-full bg-white overflow-hidden relative">
        {/* 对话记录侧边栏 - 绝对定位从左侧滑出 */}
        <div
          className={`absolute top-0 left-0 w-72 h-full border-r border-gray-200 flex flex-col transition-transform duration-300 ease-in-out z-10 bg-white shadow-lg ${showConversationList ? "translate-x-0" : "-translate-x-full"}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                {t("conversationHistory")}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowConversationList(false)}
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-gray-600"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  onClick={createNewConversation}
                  size="sm"
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800"
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
            <div className="text-xs text-gray-500 mb-2 px-2">
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
                  className={`p-3 rounded-lg cursor-pointer mb-1 transition-colors ${conversationId === conversation._id ? "bg-purple-100" : "hover:bg-gray-100"}`}
                  onClick={() => loadConversation(conversation._id)}
                >
                  <div className="flex justify-between items-start">
                    <p className="text-sm font-medium text-gray-900 truncate">
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
                    <span className="text-xs text-gray-500">
                      {formatRelativeTime(conversation.updatedAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 对话主区域 - 点击关闭侧边栏 */}
        <div
          className="h-full w-full flex flex-col"
          onClick={() => showConversationList && setShowConversationList(false)}
        >
          {/* 新对话着陆页 */}
          {messages.length === 0 && !isLoading ? (
            <div
              className="flex-1 flex flex-col bg-white px-8"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部导航栏 - 只显示时钟图标 */}
              <div className="p-4 flex items-start">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowConversationList(true)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[100]">
                      <p>{t("conversationHistory")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* 主要内容 */}
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className="text-center max-w-md">
                  {/* Notion 图标 */}
                  <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">N</span>
                    </div>
                  </div>

                  {/* 标题 */}
                  <h1 className="text-2xl font-semibold text-gray-900 mb-8">
                    {t("todayIWillHelp")}
                  </h1>

                  {/* 输入框 */}
                  <div className="relative mb-6">
                    <Input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder={t("useAIToHandleTasks")}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-800"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 快捷操作 */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="ghost"
                      className="border border-gray-200 rounded-lg p-3 justify-start text-left"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <span>{t("notionAI")}</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="border border-gray-200 rounded-lg p-3 justify-start text-left"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <span>撰写会议议程</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="border border-gray-200 rounded-lg p-3 justify-start text-left"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      <span>分析 PDF 或图片</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="border border-gray-200 rounded-lg p-3 justify-start text-left"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      <span>创建任务提醒器</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* 对话页面 */
            <div
              className="flex-1 flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* 顶部导航栏 - 只显示时钟图标 */}
              <div className="p-4 flex items-start">
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => setShowConversationList(true)}
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
                      >
                        <Clock className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="z-[100]">
                      <p>{t("conversationHistory")}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* 对话内容 */}
              <div className="flex-1 p-8 overflow-y-auto">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "mb-8 max-w-3xl",
                      message.role === "user" ? "ml-auto" : "",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg p-4",
                        message.role === "user"
                          ? "bg-gray-100 text-gray-900"
                          : "bg-white text-gray-900 border border-gray-200",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="mb-8 max-w-3xl">
                    <div className="rounded-lg p-4 bg-white text-gray-900 border border-gray-200">
                      <p>{t("thinking")}</p>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 输入区域 */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={t("useAIToHandleTasks")}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="text-gray-600">
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-600">
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="bg-gray-900 hover:bg-gray-800 text-white"
                    >
                      {t("auto")}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RAGPage;
