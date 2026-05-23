"use client";

import React from "react";
import { Clock, Trash2 } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { cn } from "@notion/business/utils";
import { useTranslations } from "next-intl";
import { Id } from "@/convex/_generated/dataModel";
import type { Conversation } from "./types";

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: Id<"aiConversations"> | null;
  isLoading: boolean;
  onSelect: (id: Id<"aiConversations">) => void;
  onDelete: (id: Id<"aiConversations">) => void;
  formatTime: (ts: number) => string;
}

export const ConversationList = React.memo(
  ({
    conversations,
    currentConversationId,
    isLoading,
    onSelect,
    onDelete,
    formatTime,
  }: ConversationListProps) => {
    const t = useTranslations("AI");

    if (isLoading) {
      return (
        <div className="p-3 text-center text-muted-foreground text-xs">
          {t("loading")}
        </div>
      );
    }

    if (conversations.length === 0) {
      return (
        <div className="p-3 text-center text-muted-foreground text-xs">
          {t("noConversationRecords")}
        </div>
      );
    }

    return (
      <div className="max-h-48 overflow-y-auto">
        {conversations.map((conv) => (
          <div
            key={conv._id}
            className={cn(
              "flex items-center justify-between p-2 rounded-md cursor-pointer text-xs transition-colors",
              currentConversationId === conv._id
                ? "bg-accent"
                : "hover:bg-muted",
            )}
            onClick={() => onSelect(conv._id)}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium">{conv.title}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {formatTime(conv.updatedAt)}
                </span>
              </div>
            </div>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv._id);
              }}
              size="sm"
              variant="ghost"
              className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500 shrink-0"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </Button>
          </div>
        ))}
      </div>
    );
  },
);

ConversationList.displayName = "ConversationList";
