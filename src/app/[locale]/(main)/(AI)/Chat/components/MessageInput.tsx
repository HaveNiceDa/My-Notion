"use client";

import { Plus, Settings, Send, Bot, Check } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";
import {
  useAIModelStore,
  AI_MODELS,
  AIModel,
} from "@/src/lib/store/use-ai-model-store";

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
}

export const MessageInput = ({
  input,
  onInputChange,
  onSend,
  onKeyPress,
  className,
}: MessageInputProps) => {
  const t = useTranslations("AI");
  const { model, setModel } = useAIModelStore();

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
          "w-full px-5 py-4 pr-44 border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-gray-200 focus:border-transparent min-h-[100px] max-h-[300px] text-lg overflow-y-auto resize-none",
          className,
        )}
      />
      <Button
        className="absolute left-2 bottom-1 bg-transparent hover:bg-gray-100 text-gray-800 rounded-full transition-all duration-200 p-3"
        onClick={() => toast.info(t("featureUnderDevelopment"))}
      >
        <Plus />
      </Button>
      <Button
        className="absolute left-10 bottom-1 bg-transparent hover:bg-gray-100 text-gray-800 rounded-full transition-all duration-200 p-3"
        onClick={() => toast.info(t("featureUnderDevelopment"))}
      >
        <Settings />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="absolute right-14 bottom-1 hover:bg-gray-200 text-gray-800 rounded-full transition-all duration-200 p-3"
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
                model === m && "bg-gray-100 font-medium",
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
        className="absolute right-2 bottom-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full transition-all duration-200 p-3"
      >
        <Send className="h-5 w-5 rounded-full" />
      </Button>
    </div>
  );
};
