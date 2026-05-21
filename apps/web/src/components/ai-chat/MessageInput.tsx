"use client";

import {
  Send,
  Bot,
  Check,
  Database,
  Plus,
  X,
  Brain,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@notion/business/utils";
import { useState, memo, useRef, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { AI_MODELS, MODEL_DISPLAY_NAMES } from "./models";
import type { AIModelId, ChatMode } from "./models";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (images?: string[]) => Promise<void>;
  modelId: AIModelId;
  onModelChange: (id: AIModelId) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  enableThinking: boolean;
  onToggleThinking: () => void;
  isSending: boolean;
}

const MessageInput = memo(
  ({
    input,
    onInputChange,
    onSend,
    modelId,
    onModelChange,
    mode,
    onModeChange,
    enableThinking,
    onToggleThinking,
    isSending,
  }: MessageInputProps) => {
    const t = useTranslations("AI");

    const handleSend = useMemoizedFn(async () => {
      if (isSending || !input.trim()) {
        if (isSending) toast.info(t("messageSendingInProgress"));
        return;
      }
      await onSend();
    });

    const handleKeyPress = useMemoizedFn(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
    );

    const handleInputChange = useMemoizedFn(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onInputChange(e.target.value);
      },
    );

    return (
      <div className="border border-border rounded-xl shadow-sm bg-background p-3">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={t("useAIToHandleTasks")}
          className={cn(
            "w-full px-0 py-0 !border-0 !shadow-none rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[60px] text-sm overflow-y-auto resize-none bg-transparent",
            isSending && "opacity-90",
          )}
        />
        <div className="flex items-center justify-between -ml-1 mt-1">
          <div className="flex items-center gap-0.5">
            <TooltipProvider>
              <Tooltip delayDuration={1}>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      "rounded-full transition-all duration-200 h-7 w-7 p-0 bg-transparent",
                      enableThinking
                        ? "hover:bg-purple-200 text-purple-600"
                        : "hover:bg-muted text-muted-foreground",
                      isSending && "opacity-50",
                    )}
                    onClick={() => {
                      if (!isSending) onToggleThinking();
                    }}
                    disabled={isSending}
                  >
                    <Brain className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("deepThinkingTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip delayDuration={1}>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      "rounded-full transition-all duration-200 h-7 w-7 p-0 bg-transparent",
                      mode === "rag"
                        ? "hover:bg-blue-200 text-blue-600"
                        : "hover:bg-muted text-muted-foreground",
                      isSending && "opacity-50",
                    )}
                    onClick={() => {
                      if (!isSending) onModeChange(mode === "rag" ? "chat" : "rag");
                    }}
                    disabled={isSending}
                  >
                    <Database className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("knowledgeBaseTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="flex items-center gap-0.5">
            <DropdownMenu>
              <TooltipProvider>
                <Tooltip delayDuration={1}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="hover:bg-muted text-foreground rounded-full transition-all duration-200 h-7 w-7 p-0 bg-transparent"
                        variant="ghost"
                        disabled={isSending}
                      >
                        <Bot className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("modelSelect")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenuContent align="end">
                {AI_MODELS.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => onModelChange(m)}
                    className={cn(
                      "cursor-pointer flex items-center justify-between",
                      modelId === m && "bg-muted font-medium",
                    )}
                  >
                    <span>{MODEL_DISPLAY_NAMES[m]}</span>
                    {modelId === m && <Check className="h-3 w-3" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className={cn(
                "bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-7 w-7 p-0",
                isSending && "opacity-70",
              )}
            >
              {isSending ? (
                <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

MessageInput.displayName = "MessageInput";

export { MessageInput };
