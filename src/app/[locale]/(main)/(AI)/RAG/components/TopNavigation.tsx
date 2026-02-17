"use client";

import { Clock } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useTranslations } from "next-intl";

interface TopNavigationProps {
  onShowHistory: () => void;
}

export const TopNavigation = ({ onShowHistory }: TopNavigationProps) => {
  const t = useTranslations("RAG");

  return (
    <div className="p-4 flex items-start">
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onShowHistory}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-gray-600 hover:bg-gray-100"
            >
              <Clock className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="z-[100]">
            <p>{t("conversationHistory")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};