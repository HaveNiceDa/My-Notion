"use client";

import { MessageSquare, FileText, Calendar, Send, File } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface NewConversationLandingProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const NewConversationLanding = ({
  input,
  onInputChange,
  onSend,
  onKeyPress,
}: NewConversationLandingProps) => {
  const t = useTranslations("RAG");

  const handleFeatureClick = () => {
    toast.info(t("featureUnderDevelopment"));
  };

  return (
    <div className="flex-1 flex flex-col bg-white px-8">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center max-w-3xl">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">N</span>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-8">
            {t("todayIWillHelp")}
          </h1>

          <div className="relative mb-8 w-full">
            <Textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder={t("useAIToHandleTasks")}
              className="w-full px-5 py-4 border border-gray-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-gray-200 focus:border-transparent min-h-[100px] resize-none text-lg"
            />
            <Button
              onClick={onSend}
              disabled={!input.trim()}
              className="absolute right-4 bottom-4 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full p-2"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-6 h-36 bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <MessageSquare className="h-7 w-7 mb-3 text-gray-600" />
              <span className="text-gray-700">{t("notionAI")}</span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-6 h-36 bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <FileText className="h-7 w-7 mb-3 text-gray-600" />
              <span className="text-gray-700">{t("writeMeetingAgenda")}</span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-6 h-36 bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <File className="h-7 w-7 mb-3 text-gray-600" />
              <span className="text-gray-700">{t("analyzePDFOrImage")}</span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-6 h-36 bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <Calendar className="h-7 w-7 mb-3 text-gray-600" />
              <span className="text-gray-700">{t("createTaskReminder")}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
