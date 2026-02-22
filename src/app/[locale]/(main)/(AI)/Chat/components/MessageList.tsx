"use client";

import { cn } from "@/src/lib/utils";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Copy,
  ChevronDown,
  ChevronUp,
  Brain,
  Database,
  Search,
  MessageSquare,
  Zap,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { useThinkingProcessStore } from "@/src/lib/store/use-thinking-process-store";
import { useEffect } from "react";

interface Message {
  id: string;
  content: string;
  role: string;
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationCreatedAt: Date | null;
  conversationId: Id<"aiConversations"> | null;
}

export const MessageList = ({
  messages,
  isLoading,
  messagesEndRef,
  conversationCreatedAt,
  conversationId,
}: MessageListProps) => {
  const t = useTranslations("AI");
  const {
    steps,
    isExpanded,
    isVisible,
    toggleExpanded,
    loadSteps,
    clearSteps,
    isLoading: isLoadingSteps,
    isLoaded,
  } = useThinkingProcessStore();

  // 当conversationId变化时，加载思考过程或清除步骤
  useEffect(() => {
    if (conversationId) {
      loadSteps(conversationId);
    } else {
      clearSteps();
    }
  }, [conversationId, loadSteps, clearSteps]);

  // 获取图标组件
  const getStepIcon = (type: string) => {
    switch (type) {
      case "knowledge-base":
        return <Database className="h-4 w-4 text-blue-500" />;
      case "retrieval":
      case "documents":
        return <Search className="h-4 w-4 text-green-500" />;
      case "query":
        return <MessageSquare className="h-4 w-4 text-purple-500" />;
      case "prompt":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      default:
        return <Brain className="h-4 w-4 text-gray-500" />;
    }
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  };

  return (
    <div className="flex-1 flex p-8 overflow-hidden min-h-0 mb-10">
      {/* 左侧思考过程 */}
      <div
        className="w-72 absolute top-40 left-4 overflow-y-auto hide-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <style>{`
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {(isLoading || isLoadingSteps || isVisible || steps.length > 0) && (
          <div className="sticky top-0 bg-background pb-4">
            <div className="rounded-lg p-3 bg-background text-foreground border border-border shadow-sm overflow-hidden transition-all duration-300 ease-in-out hover:shadow-md">
              {/* 思考过程标题栏 */}
              <div
                className="flex items-center justify-between cursor-pointer mb-2 group"
                onClick={toggleExpanded}
              >
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600">
                    {isLoading || isLoadingSteps ? (
                      <Brain className="h-3 w-3 animate-pulse" />
                    ) : (
                      <Brain className="h-3 w-3" />
                    )}
                  </div>
                  <p className="text-sm font-medium">
                    {t("recentConversationThinking")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {steps.length} 步骤
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                  )}
                </div>
              </div>

              {/* 思考过程步骤列表 */}
              {isExpanded && (
                <div className="mt-3 space-y-2 animate-in fade-in duration-500">
                  {isLoadingSteps ? (
                    <div className="flex justify-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : steps.length === 0 ? (
                    <div className="flex justify-center py-4 text-muted-foreground text-xs">
                      暂无思考过程
                    </div>
                  ) : (
                    steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="flex gap-2 p-2 rounded-lg bg-muted border border-border transition-all  hover:bg-accent hover:shadow-sm animate-in fade-in duration-500"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="flex-shrink-0">
                          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground">
                            {getStepIcon(step.type)}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">
                              {step.content}
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {formatTime(step.timestamp)}
                            </span>
                          </div>
                          {step.details && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {step.type === "documents" ? (
                                <>
                                  {(() => {
                                    try {
                                      const details = JSON.parse(step.details);
                                      return (
                                        <>
                                          <p>{details.text}</p>
                                          {details.docs &&
                                            details.docs.length > 0 && (
                                              <div className="mt-1 space-y-1">
                                                {details.docs.map(
                                                  (doc: any, index: number) => (
                                                    <a
                                                      key={index}
                                                      href={`/documents/${doc.id}`}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="block text-blue-600 underline hover:text-blue-800 transition-colors"
                                                    >
                                                      {doc.title} (相关性:{" "}
                                                      {doc.score})
                                                    </a>
                                                  ),
                                                )}
                                              </div>
                                            )}
                                        </>
                                      );
                                    } catch (e) {
                                      return <p>{step.details}</p>;
                                    }
                                  })()}
                                </>
                              ) : step.type === "start" &&
                                (step.details.includes(
                                  "开始进行文本embedding处理",
                                ) ||
                                  step.details.includes(
                                    "开始进行query embedding处理",
                                  )) ? (
                                <>
                                  {(() => {
                                    const parts = step.details.split("\n");
                                    if (parts.length > 0) {
                                      const queryPart = parts[0];
                                      const embeddingPart = parts[1];
                                      const queryMatch =
                                        queryPart.match(/查询: (.*)/) ||
                                        queryPart.match(/用户输入: (.*)/);
                                      const label = queryPart.match(
                                        /查询: (.*)/,
                                      )
                                        ? "查询"
                                        : "用户输入";
                                      return (
                                        <>
                                          {queryMatch && (
                                            <p>
                                              {label}:{" "}
                                              <span className="text-blue-600 font-medium">
                                                {queryMatch[1]}
                                              </span>
                                            </p>
                                          )}
                                          {embeddingPart && (
                                            <p>{embeddingPart}</p>
                                          )}
                                        </>
                                      );
                                    }
                                    return <p>{step.details}</p>;
                                  })()}
                                </>
                              ) : (
                                <p>{step.details}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 右侧消息列表 */}
      <div
        className="flex-1 flex justify-center overflow-y-auto hide-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div className="w-full max-w-[60%]">
          {conversationCreatedAt && (
            <div className="mb-8 text-center">
              <div className="inline-block text-muted-foreground px-4 py-1 rounded-full text-sm">
                {formatDate(conversationCreatedAt)} · Notion AI
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "mb-8",
                message.role === "user" ? "flex justify-end" : "",
              )}
            >
              <div
                className={cn(
                  "relative group max-w-[80%]",
                  message.role === "user" ? "flex flex-col items-end" : "",
                )}
              >
                <div
                  className={cn(
                    "p-4 break-words",
                    message.role === "user"
                      ? "bg-muted text-foreground rounded-3xl"
                      : "bg-background text-foreground pb-1 rounded-lg",
                  )}
                >
                  <p className="whitespace-pre-wrap text-base break-all">
                    {message.content}
                  </p>
                </div>

                {message.role === "user" && (
                  <div className="mt-1 flex justify-end gap-2 items-center w-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <button
                      className="p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                        toast.success(t("copied"));
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {message.role === "assistant" && (
                  <div className="flex justify-start gap-2 items-center w-full opacity-0 group-hover:opacity-100 transition-opacity pl-4">
                    <div className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleString("zh-CN", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                    <button
                      className="p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        navigator.clipboard.writeText(message.content);
                        toast.success(t("copied"));
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start mb-8">
              <div className="max-w-[80%]">
                <div className="p-4 break-words bg-background text-foreground pb-1 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                    <span className="text-sm text-muted-foreground">
                      正在生成响应...
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};
