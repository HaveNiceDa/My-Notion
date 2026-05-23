"use client";

import { useAIChatStore } from "@/src/lib/store/use-ai-chat-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useTranslations } from "next-intl";

// Notion 风格 AI 图标：简约黑白，与 Notion 设计语言一致
function NotionAIIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M2 3.5C2 2.67 2.67 2 3.5 2H6L8 4.5H12.5C13.33 4.5 14 5.17 14 6V12.5C14 13.33 13.33 14 12.5 14H3.5C2.67 14 2 13.33 2 12.5V3.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <path
        d="M5.5 8H10.5M8 5.5V10.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
            className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-lg shadow-md
              bg-background border border-border
              text-foreground hover:bg-muted
              transition-all duration-200 hover:shadow-lg
              flex items-center justify-center"
          >
            <NotionAIIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t("openAIChat")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
