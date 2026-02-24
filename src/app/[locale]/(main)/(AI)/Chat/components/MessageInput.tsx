"use client";

import { Plus, Settings, Send, Bot, Check, Database } from "lucide-react";
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
import { cn } from "@/src/lib/utils";
import {
  useAIModelStore,
  AI_MODELS,
  AIModel,
} from "@/src/lib/store/use-ai-model-store";
import { useKnowledgeBaseStore } from "@/src/lib/store/use-knowledge-base-store";
import { useState, useCallback } from "react";

const displayNames: Record<AIModel, string> = {
  "qwen-plus": "Qwen Plus",
  "qwen-max": "Qwen Max",
  "qwen3-coder-plus": "Qwen 3 Coder Plus",
};

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => Promise<void>;
  className?: string;
  conversationId?: string | null;
}

export const MessageInput = ({
  input,
  onInputChange,
  onSend,
  className,
  conversationId,
}: MessageInputProps) => {
  const t = useTranslations("AI");
  const { model, setModel } = useAIModelStore();
  const { enabled: knowledgeBaseEnabled, toggle: toggleKnowledgeBase } = useKnowledgeBaseStore();
  const [isSending, setIsSending] = useState(false);

  const getModelDisplayName = (modelName: AIModel) => {
    return displayNames[modelName] || modelName;
  };

  const handleSend = useCallback(async () => {
    if (isSending || !input.trim()) return;
    setIsSending(true);
    try {
      await onSend();
    } finally {
      setIsSending(false);
    }
  }, [isSending, input, onSend]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="border border-border rounded-2xl shadow-sm bg-background pt-4 px-4 pb-1">
      <Textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder={t("useAIToHandleTasks")}
        disabled={isSending}
        className={cn(
            "w-full px-0 py-0 !border-0 !shadow-none rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[80px] text-lg overflow-y-auto resize-none bg-transparent",
            className,
          )}
      />
      <div className="flex items-center justify-between -ml-2">
        <div className="flex items-center gap-1">
          <Button
            className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
            onClick={() => toast.info(t("featureUnderDevelopment"))}
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
            onClick={() => toast.info(t("featureUnderDevelopment"))}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip delayDuration={1}>
              <TooltipTrigger asChild>
                <Button
                  className={cn(
                    "rounded-full transition-all duration-200 h-9 w-9 p-0 bg-transparent",
                    knowledgeBaseEnabled
                      ? "hover:bg-blue-200 text-blue-600"
                      : "hover:bg-muted text-muted-foreground",
                  )}
                  onClick={() => {
                    toggleKnowledgeBase();
                    toast.info(
                      knowledgeBaseEnabled
                        ? t("knowledgeBaseDisabled")
                        : t("knowledgeBaseEnabled"),
                    );
                  }}
                  title={
                    knowledgeBaseEnabled
                      ? t("knowledgeBaseEnabled")
                      : t("knowledgeBaseDisabled")
                  }
                >
                  <Database className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t("knowledgeBaseTooltip")}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0 bg-transparent"
                variant="ghost"
              >
                <Bot className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {AI_MODELS.map((m) => (
                <DropdownMenuItem
                  key={m}
                  onClick={() => setModel(m)}
                  className={cn(
                    "cursor-pointer flex items-center justify-between",
                    model === m && "bg-muted font-medium",
                  )}
                >
                  <span>{getModelDisplayName(m)}</span>
                  {model === m && <Check className="h-4 w-4" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
          >
            <Send className="h-5 w-5 rounded-full" />
          </Button>
        </div>
      </div>
    </div>
  );
};
