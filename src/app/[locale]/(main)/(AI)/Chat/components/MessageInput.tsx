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

const displayNames: Record<AIModel, string> = {
  "qwen-plus": "Qwen Plus",
  "qwen-max": "Qwen Max",
  "qwen3-coder-plus": "Qwen 3 Coder Plus",
};

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  className?: string;
  conversationId?: string | null;
}

export const MessageInput = ({
  input,
  onInputChange,
  onSend,
  onKeyPress,
  className,
  conversationId,
}: MessageInputProps) => {
  const t = useTranslations("AI");
  const { model, setModel } = useAIModelStore();
  const { enabled: knowledgeBaseEnabled, toggle: toggleKnowledgeBase } = useKnowledgeBaseStore();

  const getModelDisplayName = (modelName: AIModel) => {
    return displayNames[modelName] || modelName;
  };

  return (
    <div className="relative">
      <Textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyPress={onKeyPress}
        placeholder={t("useAIToHandleTasks")}
        className={cn(
          "w-full px-5 py-4 pr-44 border border-border rounded-2xl shadow-sm focus:ring-2 focus:ring-ring focus:border-transparent min-h-[100px] max-h-[300px] text-lg overflow-y-auto resize-none",
          className,
        )}
      />
      <Button
        className="absolute left-2 bottom-1 bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 p-3"
        onClick={() => toast.info(t("featureUnderDevelopment"))}
      >
        <Plus />
      </Button>
      <Button
        className="absolute left-10 bottom-1 bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 p-3"
        onClick={() => toast.info(t("featureUnderDevelopment"))}
      >
        <Settings />
      </Button>

      <TooltipProvider>
        <Tooltip delayDuration={1}>
          <TooltipTrigger asChild>
            <Button
              className={cn(
                "absolute right-24 bottom-1 rounded-full transition-all duration-200 p-3 bg-background",
                knowledgeBaseEnabled
                  ? "hover:bg-blue-200 text-blue-600"
                  : " hover:bg-muted text-muted-foreground",
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
            className="absolute right-12 bottom-1 hover:bg-muted text-foreground rounded-full transition-all duration-200 p-3"
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
        onClick={onSend}
        disabled={!input.trim()}
        className="absolute right-2 bottom-1 bg-background hover:bg-muted text-foreground rounded-full transition-all duration-200 p-3"
      >
        <Send className="h-5 w-5 rounded-full" />
      </Button>
    </div>
  );
};
