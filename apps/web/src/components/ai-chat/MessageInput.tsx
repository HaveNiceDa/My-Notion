"use client";

import {
  Send,
  Check,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@notion/business/utils";
import { memo, useState } from "react";
import { useMemoizedFn } from "ahooks";
import { AI_MODELS, MODEL_DISPLAY_NAMES } from "./models";
import type { AIModelId } from "./models";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (images?: string[]) => Promise<void>;
  modelId: AIModelId;
  onModelChange: (id: AIModelId) => void;
  enableThinking: boolean;
  isSending: boolean;
}

const MessageInput = memo(
  ({
    input,
    onInputChange,
    onSend,
    modelId,
    onModelChange,
    isSending,
  }: MessageInputProps) => {
    const t = useTranslations("AI");
    const [modelOpen, setModelOpen] = useState(false);

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
            <Popover open={modelOpen} onOpenChange={setModelOpen}>
              <PopoverTrigger asChild>
                <Button
                  className="h-7 rounded-md px-2 text-xs font-medium bg-transparent hover:bg-muted text-muted-foreground transition-colors"
                  variant="ghost"
                  disabled={isSending}
                >
                  {MODEL_DISPLAY_NAMES[modelId]}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-48 p-1"
              >
                {AI_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onModelChange(m);
                      setModelOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors",
                      modelId === m
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span>{MODEL_DISPLAY_NAMES[m]}</span>
                    {modelId === m && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-0.5">
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
