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
import { MODEL_DISPLAY_NAMES } from "@/src/lib/ai/config";
import { useKnowledgeBaseStore } from "@/src/lib/store/use-knowledge-base-store";
import { useState, memo } from "react";
import { useMemoizedFn } from "ahooks";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => Promise<void>;
  className?: string;
  conversationId?: string | null;
}

const MessageInput = memo(
  ({ input, onInputChange, onSend, className }: MessageInputProps) => {
    const t = useTranslations("AI");
    const { model, setModel } = useAIModelStore();
    const { enabled: knowledgeBaseEnabled, toggle: toggleKnowledgeBase } =
      useKnowledgeBaseStore();
    const [isSending, setIsSending] = useState(false);

    const getModelDisplayName = useMemoizedFn((modelName: AIModel) => {
      return MODEL_DISPLAY_NAMES[modelName] || modelName;
    });

    const handleSend = useMemoizedFn(async () => {
      if (isSending || !input.trim()) {
        if (isSending) {
          toast.info(t("messageSendingInProgress"));
        }
        return;
      }
      setIsSending(true);
      try {
        await onSend();
      } finally {
        setIsSending(false);
      }
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
      <div className="border border-border rounded-2xl shadow-sm bg-background pt-4 px-4 pb-1">
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          placeholder={t("useAIToHandleTasks")}
          className={cn(
            "w-full px-0 py-0 !border-0 !shadow-none rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[80px] text-lg overflow-y-auto resize-none bg-transparent",
            isSending && "opacity-90",
            className,
          )}
        />
        <div className="flex items-center justify-between -ml-2">
          <div className="flex items-center gap-1">
            <Button
              className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
              onClick={() => toast.info(t("featureUnderDevelopment"))}
              disabled={isSending}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
              onClick={() => toast.info(t("featureUnderDevelopment"))}
              disabled={isSending}
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
                      isSending && "opacity-50",
                    )}
                    onClick={() => {
                      if (!isSending) {
                        toggleKnowledgeBase();
                        toast.info(
                          knowledgeBaseEnabled
                            ? t("knowledgeBaseDisabled")
                            : t("knowledgeBaseEnabled"),
                        );
                      }
                    }}
                    title={
                      knowledgeBaseEnabled
                        ? t("knowledgeBaseEnabled")
                        : t("knowledgeBaseDisabled")
                    }
                    disabled={isSending}
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
                  disabled={isSending}
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
              className={cn(
                "bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0",
                isSending && "opacity-70",
              )}
            >
              {isSending ? (
                <div className="w-5 h-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
              ) : (
                <Send className="h-5 w-5 rounded-full" />
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
