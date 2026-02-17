"use client";

import { Plus, Settings, Send } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { useTranslations } from "next-intl";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const MessageInput = ({
  input,
  onInputChange,
  onSend,
  onKeyPress,
}: MessageInputProps) => {
  const t = useTranslations("RAG");

  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={onKeyPress}
          placeholder={t("useAIToHandleTasks")}
          className="flex-1 min-h-[80px] resize-none"
        />
        <div className="flex items-end gap-2">
          <Button variant="ghost" size="sm" className="text-gray-600">
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-gray-600">
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            onClick={onSend}
            disabled={!input.trim()}
            className="bg-gray-900 hover:bg-gray-800 text-white"
          >
            {t("auto")}
          </Button>
        </div>
      </div>
    </div>
  );
};
