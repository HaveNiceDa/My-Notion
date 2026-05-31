"use client";

import { useAIChatStore } from "@/src/lib/store/use-ai-chat-store";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { cn } from "@notion/business/utils";

function AIIcon({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/logo.png"
        alt="AI"
        className={cn(className, "dark:hidden")}
        draggable={false}
      />
      <img
        src="/logo-dark.png"
        alt="AI"
        className={cn(className, "hidden dark:block")}
        draggable={false}
      />
    </>
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
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-md
              bg-background border border-border
              hover:bg-muted
              transition-all duration-200 hover:shadow-lg
              flex items-center justify-center"
          >
            <AIIcon className="h-7 w-7" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>{t("openAIChat")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
