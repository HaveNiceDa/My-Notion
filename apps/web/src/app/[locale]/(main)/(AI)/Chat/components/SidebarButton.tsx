"use client";

import { Button } from "@/src/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { cn } from "@/src/lib/utils";

interface SidebarButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  tooltip: string;
  variant?: "ghost" | "default";
  className?: string;
}

export const SidebarButton = ({
  onClick,
  children,
  tooltip,
  variant = "ghost",
  className,
}: SidebarButtonProps) => {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            size="sm"
            variant={variant}
            className={cn("h-8 w-8 p-0 text-gray-600", className)}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
