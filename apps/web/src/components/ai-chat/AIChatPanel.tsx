"use client";

import React, { useRef, useEffect, useMemo, useState, useCallback } from "react";
import { formatRelativeTime } from "@notion/business/utils";
import { useTranslations } from "next-intl";
import {
  Plus,
  ChevronDown,
  History,
  PanelRightClose,
  Search,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@notion/business/utils";
import { Id } from "@/convex/_generated/dataModel";
import { useAIChatStore } from "@/src/lib/store/use-ai-chat-store";
import { useResizableWidth } from "@/src/hooks/useResizableWidth";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useAIChat } from "./useAIChat";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { ConversationList } from "./ConversationList";
import { EmptyHome } from "./EmptyHome";

export function AIChatPanel() {
  const { panelOpen, closePanel } = useAIChatStore();
  const { width, handleMouseDown } = useResizableWidth({
    initialWidth: 400,
    minWidth: 320,
    maxWidth: 520,
    localStorageKey: "ai-chat-panel-width",
    direction: "left",
  });
  const tc = useTranslations("Common");
  const t = useTranslations("AI");

  const {
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
    agentMode,
    setAgentMode,
    sendMessage,
    toolCalls,
    createNewConversation,
    loadConversation,
    deleteConversation,
  } = useAIChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showConvList, setShowConvList] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
  }, [setInput]);

  const formatTime = useCallback((ts: number) => formatRelativeTime(ts, tc), [tc]);

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conv) =>
      conv.title.toLowerCase().includes(query),
    );
  }, [conversationSearch, conversations]);

  const handleLoadConversation = useCallback((id: Id<"aiConversations">) => {
    loadConversation(id);
    setShowConvList(false);
  }, [loadConversation]);

  const handlePromptSelect = useCallback((prompt: string) => {
    setInput(prompt);
  }, [setInput]);

  const handleExecutePlan = useCallback(async (prompt: string) => {
    await sendMessage([], { inputOverride: prompt, mode: "chat" });
  }, [sendMessage]);

  const convListRef = useRef<HTMLDivElement>(null);
  const convButtonRef = useRef<HTMLButtonElement>(null);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      convListRef.current &&
      !convListRef.current.contains(e.target as Node) &&
      convButtonRef.current &&
      !convButtonRef.current.contains(e.target as Node)
    ) {
      setShowConvList(false);
    }
  }, []);

  useEffect(() => {
    if (showConvList) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showConvList, handleClickOutside]);

  if (!panelOpen) return null;

  return (
    <div
      className="h-full border-l border-border bg-background flex flex-col shrink-0 relative z-10 shadow-[-8px_0_24px_rgba(15,23,42,0.08)] dark:shadow-[-8px_0_24px_rgba(0,0,0,0.28)]"
      style={{ width: `${width}px` }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 z-10 transition-colors"
        onMouseDown={handleMouseDown}
      />

      <div className="relative z-20 flex items-center justify-between px-3 py-2 border-b border-border bg-background/95 backdrop-blur shrink-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            ref={convButtonRef}
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 px-2 text-sm font-medium"
            onClick={() => setShowConvList(!showConvList)}
          >
            <History className="mr-1.5 h-4 w-4 shrink-0" />
            <span className="truncate">{t("conversationHistory")}</span>
            <ChevronDown
              className={cn(
                "ml-1 h-3.5 w-3.5 shrink-0 transition-transform",
                showConvList && "rotate-180",
              )}
            />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={createNewConversation}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("newConversation")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={closePanel}
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("hideSidebar")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {showConvList && (
        <div
          ref={convListRef}
          className="absolute left-3 right-3 top-12 z-30 rounded-xl border border-border bg-popover p-2 shadow-lg"
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder={t("searchConversationHistory")}
              className="h-8 pl-7 text-xs"
            />
          </div>
          <ConversationList
            conversations={filteredConversations}
            currentConversationId={conversationId}
            isLoading={isLoadingConversations}
            onSelect={handleLoadConversation}
            onDelete={deleteConversation}
            formatTime={formatTime}
          />
        </div>
      )}

      {messages.length === 0 ? (
        <EmptyHome onPromptSelect={handlePromptSelect} />
      ) : (
        <MessageList
          messages={messages}
          isLoading={isLoading}
          toolCalls={toolCalls}
          messagesEndRef={messagesEndRef}
          conversationCreatedAt={conversationCreatedAt}
          onExecutePlan={handleExecutePlan}
        />
      )}

      <div className="px-3 pb-3 pt-1 shrink-0 bg-background">
        <MessageInput
          input={input}
          onInputChange={handleInputChange}
          onSend={sendMessage}
          agentMode={agentMode}
          onAgentModeChange={setAgentMode}
          modelId={modelId}
          onModelChange={setModelId}
          enableThinking={enableThinking}
          isSending={isLoading}
        />
      </div>
    </div>
  );
}
