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
import { useNavigation } from "@/src/hooks/use-navigation";

interface TopNavigationProps {
  onShowHistory: () => void;
}

export const TopNavigation = ({ onShowHistory }: TopNavigationProps) => {
  const t = useTranslations("AI");
  const { isCollapsed } = useNavigation();

  return (
    <div
      className={`relative top-1 flex items-start z-[100000] w-full ${isCollapsed ? "left-10" : "left-4"}`}
    >
      <TooltipProvider delayDuration={100}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onShowHistory}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-muted-foreground hover:bg-muted"
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
