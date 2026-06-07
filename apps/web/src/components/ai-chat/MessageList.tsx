"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@notion/business/utils";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, ChevronDown, ChevronUp, Brain, RotateCcw, ArrowDown } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ChatMessage, ToolCall, ToolCallResult } from "./types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolCallCard } from "./ToolCallCard";

interface MessageItemProps {
  message: ChatMessage;
  activeToolCalls?: ToolCall[];
  isStreaming?: boolean;
  onExecutePlan?: (prompt: string) => Promise<void>;
  canResume?: boolean;
  onResume?: () => Promise<void>;
}

const MessageItem = React.memo(({
  message,
  activeToolCalls,
  isStreaming,
  onExecutePlan,
  canResume,
  onResume,
}: MessageItemProps) => {
  const t = useTranslations("AI");
  const [showThinking, setShowThinking] = useState(true);

  const getMessageText = () => {
    try {
      const parsedContent = JSON.parse(message.content);
      if (parsedContent.text) return parsedContent.text;
      if (parsedContent.content) return parsedContent.content;
      return message.content;
    } catch {
      return message.content;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getMessageText());
    toast.success(t("copied"));
  };

  const renderMessageContent = () => {
    try {
      const parsedContent = JSON.parse(message.content);
      if (parsedContent.images && parsedContent.images.length > 0) {
        return (
          <div className="space-y-3">
            {parsedContent.text && (
              <MarkdownRenderer content={parsedContent.text} />
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
                    className="w-full h-auto max-h-32 object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      } else if (parsedContent.text) {
        return <MarkdownRenderer content={parsedContent.text} />;
      } else if (parsedContent.content) {
        return <MarkdownRenderer content={parsedContent.content} />;
      }
      return <MarkdownRenderer content={message.content} />;
    } catch {
      return <MarkdownRenderer content={message.content} />;
    }
  };

  const getGroupedToolResults = () => {
    if (message.role !== "assistant") return null;

    const persistedResults = message.toolResults;
    if (persistedResults && persistedResults.length > 0) {
      return groupRepeatedToolResults(persistedResults);
    }

    if (activeToolCalls && activeToolCalls.length > 0) {
      return groupRepeatedToolResults(
        activeToolCalls.map((tc) => ({
          id: tc.id,
          name: tc.name,
          parameters: tc.parameters,
          status: tc.status,
          result: tc.result,
        })),
      );
    }

    return null;
  };

  const renderToolResults = (placement: "before" | "after") => {
    const groupedResults = getGroupedToolResults();
    if (!groupedResults || groupedResults.length === 0) return null;

    const persistedMessageId = isConvexMessageId(message.id)
      ? message.id as Id<"aiMessages">
      : undefined;
    const filteredResults = groupedResults.filter((toolResult) =>
      placement === "after"
        ? requiresUserConfirmation(toolResult.name)
        : !requiresUserConfirmation(toolResult.name),
    );
    if (filteredResults.length === 0) return null;

    return (
      <div className={cn("space-y-1.5", placement === "before" ? "mb-2" : "mt-2")}>
        {filteredResults.map((toolResult, index) => (
          <ToolCallCard
            key={`${toolResult.id}-${toolResult.name}-${index}`}
            toolResult={toolResult}
            messageId={persistedMessageId}
            isStreaming={isStreaming}
            onExecutePlan={toolResult.name === "task_plan" ? onExecutePlan : undefined}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={cn("mb-4", message.role === "user" ? "flex justify-end" : "")}>
      <div
        className={cn(
          "relative group max-w-[90%]",
          message.role === "user" ? "flex flex-col items-end" : "",
        )}
      >
        {message.role === "assistant" && message.reasoningContent && (
          <div className="mb-2">
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 border border-purple-200 dark:border-purple-800 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowThinking(!showThinking)}
                className="w-full flex items-center justify-between p-2 text-xs hover:bg-purple-100/50 dark:hover:bg-purple-900/20 transition-all"
              >
                <div className="flex items-center gap-2">
                  <Brain className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-purple-700 dark:text-purple-300">
                    {t("deepThinking")}
                  </span>
                </div>
                {showThinking ? (
                  <ChevronUp className="h-3 w-3 text-purple-500" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-purple-500" />
                )}
              </button>
              {showThinking && (
                <div className="px-2 pb-2 text-xs text-gray-700 dark:text-gray-300 border-t border-purple-200 dark:border-purple-800/50">
                  <div className="bg-white/70 dark:bg-gray-900/50 rounded p-2 max-h-40 overflow-y-auto">
                    <MarkdownRenderer content={message.reasoningContent} className="text-xs" />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            "p-3 break-words",
            message.role === "user"
              ? "bg-muted text-foreground rounded-2xl"
              : "bg-background text-foreground pb-1",
          )}
        >
          {renderToolResults("before")}
          {renderMessageContent()}
          {renderToolResults("after")}
          {message.role === "assistant" && canResume && onResume && (
            <button
              type="button"
              onClick={onResume}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              {t("resumeGeneration")}
            </button>
          )}
        </div>

        <div
          className={cn(
            "flex gap-2 items-center w-full opacity-0 group-hover:opacity-100 transition-opacity mt-1",
            message.role === "user" ? "justify-end" : "justify-start pl-3",
          )}
        >
          <div className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleString("zh-CN", {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          <button
            className="p-0.5 text-muted-foreground hover:text-foreground"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = "MessageItem";

function isConvexMessageId(id: string): boolean {
  return !/^\d+$/.test(id);
}

function groupRepeatedToolResults(results: ToolCallResult[]): ToolCallResult[] {
  const grouped = new Map<string, ToolCallResult>();
  const output: ToolCallResult[] = [];

  for (const result of results) {
    if (!isReadOnlyTool(result.name)) {
      output.push(result);
      continue;
    }
    const key = `${result.name}:${getToolArguments(result)}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...result, duplicateCount: 1 });
      output.push(grouped.get(key)!);
      continue;
    }
    existing.duplicateCount = (existing.duplicateCount ?? 1) + 1;
    if (result.status !== "completed") {
      existing.status = result.status;
    }
    existing.result = result.result ?? existing.result;
  }

  return output;
}

function isReadOnlyTool(toolName: string): boolean {
  return [
    "knowledge_search",
    "web_search",
    "web_extract",
    "document_search",
    "document_read",
    "memory_search",
    "task_plan",
  ].includes(toolName);
}

function requiresUserConfirmation(toolName: string): boolean {
  return ["document_write", "document_update", "memory_write"].includes(toolName);
}

function getToolArguments(result: ToolCallResult): string {
  const args = result.parameters?.arguments;
  if (typeof args === "string") return args;
  if (result.result && typeof result.result === "object") {
    const record = result.result as Record<string, unknown>;
    const fallback = record.url ?? record.finalUrl ?? record.query;
    if (typeof fallback === "string") return fallback;
  }
  return JSON.stringify(result.parameters ?? {});
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  toolCalls?: ToolCall[];
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  conversationCreatedAt: Date | null;
  onExecutePlan?: (prompt: string) => Promise<void>;
  canResumeLastRun?: boolean;
  onResumeLastRun?: () => Promise<void>;
}

export const MessageList = React.memo(
  ({
    messages,
    isLoading,
    toolCalls = [],
    messagesEndRef,
    conversationCreatedAt,
    onExecutePlan,
    canResumeLastRun,
    onResumeLastRun,
  }: MessageListProps) => {
    const t = useTranslations("AI");
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);
    const shouldAutoScrollRef = useRef(true);
    const [showScrollToBottom, setShowScrollToBottom] = useState(false);

    const formatDate = useMemo(() => {
      if (!conversationCreatedAt) return null;
      return conversationCreatedAt.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "long",
      });
    }, [conversationCreatedAt]);

    const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;
    const lastMessageRole = messages.at(-1)?.role;

    const handleScroll = () => {
      const element = scrollContainerRef.current;
      if (!element) return;
      const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
      const isNearBottom = distanceToBottom < 48;
      shouldAutoScrollRef.current = isNearBottom;
      setShowScrollToBottom(!isNearBottom);
    };

    const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
      shouldAutoScrollRef.current = true;
      setShowScrollToBottom(false);
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, [messagesEndRef]);

    useEffect(() => {
      if (!shouldAutoScrollRef.current) return;
      const timer = window.setTimeout(() => {
        scrollToBottom("auto");
      }, 0);
      return () => window.clearTimeout(timer);
    }, [messages, toolCalls, isLoading, messagesEndRef, scrollToBottom]);

    useEffect(() => {
      if (lastMessageRole !== "user") return;
      const timer = window.setTimeout(() => scrollToBottom("smooth"), 0);
      return () => window.clearTimeout(timer);
    }, [lastMessageRole, messages.length, scrollToBottom]);

    return (
      <div className="relative flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-4 py-2"
        >
          {conversationCreatedAt && (
            <div className="mb-4 text-center">
              <div className="inline-block text-muted-foreground px-3 py-0.5 rounded-full text-xs">
                {formatDate} · Notion AI
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageItem
              key={message.id}
              message={message}
              isStreaming={isLoading}
              activeToolCalls={message.role === "assistant" && message.id === lastAssistantId && !message.toolResults?.length ? toolCalls : undefined}
              onExecutePlan={onExecutePlan}
              canResume={message.role === "assistant" && message.id === lastAssistantId && canResumeLastRun}
              onResume={onResumeLastRun}
            />
          ))}

          {isLoading && !messages.some((m) => m.role === "assistant" && m.id === lastAssistantId && m.toolResults?.length) && (
            <div className="flex justify-start mb-4">
              <div className="max-w-[90%]">
                <div className="p-3 break-words bg-background text-foreground pb-1">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-xs text-muted-foreground">
                      {t("generatingResponse") || "正在生成响应..."}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        {showScrollToBottom && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-3 right-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/95 text-muted-foreground shadow-md transition-colors hover:text-foreground"
            aria-label={t("scrollToBottom")}
            title={t("scrollToBottom")}
          >
            <ArrowDown className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  },
);

MessageList.displayName = "MessageList";
