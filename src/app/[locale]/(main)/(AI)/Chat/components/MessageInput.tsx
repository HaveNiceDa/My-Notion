"use client";

import { Plus, Settings, Send } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";

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

  return (
    <div className="relative">
      <Textarea
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyPress={onKeyPress}
        placeholder={t("useAIToHandleTasks")}
        className={cn(
          "w-full px-5 py-4 pr-14 border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-gray-200 focus:border-transparent min-h-[100px] max-h-[300px] text-lg overflow-y-auto resize-none",
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
