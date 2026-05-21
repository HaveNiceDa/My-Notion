"use client";

import { Sparkles } from "lucide-react";
import { useAIChatStore } from "@/src/lib/store/use-ai-chat-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useTranslations } from "next-intl";

export function AIFloatingButton() {
  const { panelOpen, togglePanel } = useAIChatStore();
  const t = useTranslations("AI");

  if (panelOpen) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={togglePanel}
            className="fixed bottom-6 right-6 z-50 h-11 w-11 rounded-full shadow-lg
              bg-gradient-to-br from-blue-500 to-violet-500
              text-white hover:from-blue-600 hover:to-violet-600
              transition-all duration-200 hover:scale-105 hover:shadow-xl
              flex items-center justify-center
              border border-white/20"
          >
            <Sparkles className="h-5 w-5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t("openAIChat") || "打开 AI 助手"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
