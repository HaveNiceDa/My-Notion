"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";
import { useUser } from "@clerk/clerk-react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { runRAGQueryStream } from "@/src/lib/rag";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] =
    useState<Id<"ragConversations"> | null>(null);
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
              title: "新对话",
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

      // 执行RAG查询（流式输出）
      let currentContent = "";
      await runRAGQueryStream(
        user.id,
        input,
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

  if (!user) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900">
        <div className="container mx-auto px-4 py-8 max-w-3xl flex items-center justify-center h-full">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden p-8 text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              请先登录
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              登录后才能使用智能客服功能
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-purple-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 py-4 px-6">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-white" />
              <h1 className="text-xl font-semibold text-white">智能客服</h1>
            </div>
          </div>

          <div className="p-4 h-[600px] overflow-y-auto bg-gray-50 dark:bg-gray-900">
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
                  <p className="text-sm">Thinking...</p>
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
                placeholder="请输入您的问题..."
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
