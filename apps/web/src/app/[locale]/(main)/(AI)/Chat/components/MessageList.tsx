"use client";

import React, { useEffect, useMemo, ReactNode, useState } from "react";
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
  Zap,
} from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { useThinkingProcessStore } from "@/src/lib/store/use-thinking-process-store";

interface Message {
  id: string;
  content: string;
  reasoningContent?: string;
  role: string;
  timestamp: Date;
}

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationCreatedAt: Date | null;
  conversationId: Id<"aiConversations"> | null;
  knowledgeBaseEnabled: boolean;
}

// 优化步骤项组件
const StepItem = React.memo(({ step, index }: { step: any; index: number }) => {
  const t = useTranslations("AI");

  // 获取图标组件
  const getStepIcon = (type: string): ReactNode => {
    switch (type) {
      case "knowledge-base":
        return <Database className="h-4 w-4 text-blue-500" />;
      case "query":
        return <Brain className="h-4 w-4 text-purple-500" />;
      case "retrieval":
        return <Search className="h-4 w-4 text-green-500" />;
      case "documents":
        return <Search className="h-4 w-4 text-green-500" />;
      case "prompt":
        return <Zap className="h-4 w-4 text-yellow-500" />;
      case "api":
        return <Brain className="h-4 w-4 text-gray-500" />;
      default:
        return <Brain className="h-4 w-4 text-gray-500" />;
    }
  };

  // 格式化时间
  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // 处理步骤详情
  const renderStepDetails = useMemo(() => {
    if (!step.details) return null;

    if (step.type === "documents") {
      try {
        const details = JSON.parse(step.details);
        return (
          <>
            <p>{details.text}</p>
            {details.docs && details.docs.length > 0 && (
              <div className="mt-1 space-y-1">
                {details.docs.map((doc: any, docIndex: number) => (
                  <a
                    key={docIndex}
                    href={`/documents/${doc.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 underline hover:text-blue-800 transition-colors"
                  >
                    {doc.title} (相关性:{parseFloat(doc.score).toFixed(2)})
                  </a>
                ))}
              </div>
            )}
          </>
        );
      } catch (e) {
        return <p>{step.details}</p>;
      }
    } else if (
      step.type === "query" &&
      (step.details.includes("开始进行文本embedding处理") ||
        step.details.includes("开始进行query embedding处理"))
    ) {
      const parts = step.details.split("\n");
      if (parts.length > 0) {
        const queryPart = parts[0];
        const embeddingPart = parts[1];
        const queryMatch =
          queryPart.match(/查询: (.*)/) || queryPart.match(/用户输入: (.*)/);
        const label = queryPart.match(/查询: (.*)/) ? "查询" : "用户输入";
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
            {embeddingPart && <p>{embeddingPart}</p>}
          </>
        );
      }
      return <p>{step.details}</p>;
    } else {
      return <p>{step.details}</p>;
    }
  }, [step.details, step.type]);

  return (
    <div
      key={step.id}
      className="flex gap-2 p-2 rounded-lg bg-muted border border-border transition-all hover:bg-accent hover:shadow-sm"
    >
      <div className="flex-shrink-0">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground">
          {getStepIcon(step.type)}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">{step.content}</p>
          <span className="text-xs text-muted-foreground">
            {formatTime(step.timestamp)}
          </span>
        </div>
        {step.details && (
          <div className="text-xs text-muted-foreground mt-1">
            {renderStepDetails}
          </div>
        )}
      </div>
    </div>
  );
});

// 优化消息项组件
const MessageItem = React.memo(({ message }: { message: Message }) => {
  const t = useTranslations("AI");
  const [showThinking, setShowThinking] = useState(true);

  const getMessageText = () => {
    try {
      const parsedContent = JSON.parse(message.content);
      if (parsedContent.text) {
        return parsedContent.text;
      }
      if (parsedContent.content) {
        return parsedContent.content;
      }
      return message.content;
    } catch {
      return message.content;
    }
  };

  const handleCopy = () => {
    const textToCopy = getMessageText();
    navigator.clipboard.writeText(textToCopy);
    toast.success(t("copied"));
  };

  const renderMessageContent = () => {
    try {
      const parsedContent = JSON.parse(message.content);
      if (parsedContent.images && parsedContent.images.length > 0) {
        return (
          <div className="space-y-3">
            {parsedContent.text && (
              <p className="whitespace-pre-wrap text-base break-all">
                {parsedContent.text}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {parsedContent.images.map((image: string, index: number) => (
                <div
                  key={index}
                  className="relative rounded-lg overflow-hidden border border-border"
                >
                  <img
                    src={image}
                    alt={`Image ${index + 1}`}
                    className="w-full h-auto max-h-48 object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (parsedContent.text) {
        return (
          <p className="whitespace-pre-wrap text-base break-all">
            {parsedContent.text}
          </p>
        );
      } else if (parsedContent.content) {
        return (
          <p className="whitespace-pre-wrap text-base break-all">
            {parsedContent.content}
          </p>
        );
      } else {
        return (
          <p className="whitespace-pre-wrap text-base break-all">
            {message.content}
          </p>
        );
      }
    } catch {
      return (
        <p className="whitespace-pre-wrap text-base break-all">
          {message.content}
        </p>
      );
    }
  };

  return (
    <div
      key={message.id}
      className={cn("mb-8", message.role === "user" ? "flex justify-end" : "")}
    >
      <div
        className={cn(
          "relative group max-w-[80%]",
          message.role === "user" ? "flex flex-col items-end" : "",
        )}
      >
        {/* 深度思考内容区域 - 仅在 assistant 消息且有 reasoningContent 时显示 */}
        {message.role === "assistant" && message.reasoningContent && (
          <div className="mb-3">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-800 rounded-xl overflow-hidden shadow-sm">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="w-full flex items-center justify-between p-4 text-sm hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/50">
                    <Brain className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold text-purple-700 dark:text-purple-300">
                      {t("deepThinking")}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showThinking ? (
                    <ChevronUp className="h-5 w-5 text-purple-500 dark:text-purple-400 transition-transform" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-purple-500 dark:text-purple-400 transition-transform" />
                  )}
                </div>
              </button>
              {showThinking && (
                <div className="px-4 pb-4 pt-2 text-sm text-gray-700 dark:text-gray-300 border-t border-purple-200 dark:border-purple-800/50">
                  <div className="bg-white/70 dark:bg-gray-900/50 rounded-lg p-3 backdrop-blur-sm max-h-64 overflow-y-auto">
                    <p className="whitespace-pre-wrap leading-relaxed">
                      {message.reasoningContent}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            "p-4 break-words",
            message.role === "user"
              ? "bg-muted text-foreground rounded-3xl"
              : "bg-background text-foreground pb-1 rounded-lg",
          )}
        >
          {renderMessageContent()}
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
              onClick={handleCopy}
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
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export const MessageList = React.memo(
  ({
    messages,
    isLoading,
    messagesEndRef,
    conversationCreatedAt,
    conversationId,
    knowledgeBaseEnabled,
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

    // 格式化日期
    const formatDate = useMemo(() => {
      if (!conversationCreatedAt) return null;
      return conversationCreatedAt.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    }, [conversationCreatedAt]);

    // 渲染思考过程步骤
    const renderThinkingSteps = useMemo(() => {
      if (isLoadingSteps) {
        return (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        );
      }

      if (steps.length === 0) {
        return (
          <div className="flex justify-center py-4 text-muted-foreground text-xs">
            暂无思考过程
          </div>
        );
      }

      return steps.map((step, index) => (
        <StepItem key={step.id} step={step} index={index} />
      ));
    }, [steps, isLoadingSteps]);

    // 渲染消息列表
    const renderMessages = useMemo(() => {
      return messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ));
    }, [messages]);

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
          {knowledgeBaseEnabled &&
            (isLoading || isLoadingSteps || isVisible || steps.length > 0) && (
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
                    <div className="mt-3 space-y-2">{renderThinkingSteps}</div>
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
                  {formatDate} · Notion AI
                </div>
              </div>
            )}

            {renderMessages}

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
  },
);

MessageList.displayName = "MessageList";
StepItem.displayName = "StepItem";
MessageItem.displayName = "MessageItem";
