"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Clock,
  Pin,
  PinOff,
  Home,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslations } from "next-intl";
import { SidebarButton } from "./SidebarButton";

interface Conversation {
  _id: Id<"ragConversations">;
  title: string;
  updatedAt: number;
}

interface ConversationSidebarProps {
  show: boolean;
  isPinned: boolean;
  conversations: Conversation[];
  isLoading: boolean;
  onClose: () => void;
  onPin: () => void;
  onNewConversation: () => void;
  onSelectConversation: (convId: Id<"ragConversations">) => void;
  onDeleteConversation: (convId: Id<"ragConversations">) => void;
  currentConversationId: Id<"ragConversations"> | null;
  formatRelativeTime: (timestamp: number) => string;
}

export const ConversationSidebar = ({
  show,
  isPinned,
  conversations,
  isLoading,
  onClose,
  onPin,
  onNewConversation,
  onSelectConversation,
  onDeleteConversation,
  currentConversationId,
  formatRelativeTime,
}: ConversationSidebarProps) => {
  const t = useTranslations("RAG");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.title.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [conversations, searchQuery],
  );

  return (
    <div
      className={cn(
        "absolute top-0 left-0 w-72 h-full border-r border-gray-200 flex flex-col z-[100001] bg-white",
        isPinned
          ? "translate-x-0 shadow-none"
          : show
            ? "translate-x-0 shadow-lg transition-transform duration-300 ease-in-out"
            : "-translate-x-full transition-transform duration-300 ease-in-out",
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="p-4 pb-0">
        <div className="flex items-center justify-between ">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            {t("conversationHistory")}
          </h2>
          <div className="flex items-center gap-0.5">
            <SidebarButton
              onClick={() => {
                router.push(`/RAG`);
                onClose();
              }}
              tooltip={t("goHome")}
            >
              <Home className="h-4 w-4" />
            </SidebarButton>
            <SidebarButton
              onClick={onPin}
              tooltip={isPinned ? t("unpinSidebar") : t("pinSidebar")}
            >
              {isPinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
            </SidebarButton>
            <SidebarButton onClick={onClose} tooltip={t("closeSidebar")}>
              <ChevronLeft className="h-4 w-4" />
            </SidebarButton>
            <SidebarButton
              onClick={onNewConversation}
              tooltip={t("newAIConversation")}
            >
              <Plus className="h-4 w-4" />
            </SidebarButton>
          </div>
        </div>
      </div>
      <div className="p-2">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchConversationHistory")}
          className="w-full border border-gray-200 rounded-md shadow-sm focus:ring-2 focus:ring-gray-200 focus:border-transparent"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="text-xs text-gray-500 mb-2 px-2">{t("past30Days")}</div>
        {isLoading ? (
          <div className="p-4 text-center text-gray-500">{t("loading")}</div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            {searchQuery
              ? t("noMatchingConversations")
              : t("noConversationRecords")}
          </div>
        ) : (
          filteredConversations.map((conversation) => (
            <div
              key={conversation._id}
              className={cn(
                "p-3 rounded-lg cursor-pointer mb-1 transition-colors",
                currentConversationId === conversation._id
                  ? "bg-purple-100"
                  : "hover:bg-gray-100",
              )}
              onClick={() => onSelectConversation(conversation._id)}
            >
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {conversation.title}
                </p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conversation._id);
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-xs text-gray-500">
                  {formatRelativeTime(conversation.updatedAt)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
