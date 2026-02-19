"use client";

import { MessageSquare, FileText, Calendar, File } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { MessageInput } from "./MessageInput";

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
  const t = useTranslations("AI");

  const handleFeatureClick = () => {
    toast.info(t("featureUnderDevelopment"));
  };

  return (
    <div className="flex-1 flex flex-col bg-white px-8">
      <div className="flex-1 flex flex-col items-center justify-center py-8">
        <div className="text-center max-w-3xl w-full">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">N</span>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-8">
            {t("todayIWillHelp")}
          </h1>

          <div className="relative mb-8 w-full">
            <MessageInput
              input={input}
              onInputChange={onInputChange}
              onSend={onSend}
              onKeyPress={onKeyPress}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-5 h-auto bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <MessageSquare className="h-6 w-6 mb-2 text-gray-600" />
              <span className="text-gray-700 text-sm">{t("notionAI")}</span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-5 h-auto bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <FileText className="h-6 w-6 mb-2 text-gray-600" />
              <span className="text-gray-700 text-sm">
                {t("writeMeetingAgenda")}
              </span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-5 h-auto bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <File className="h-6 w-6 mb-2 text-gray-600" />
              <span className="text-gray-700 text-sm">
                {t("analyzePDFOrImage")}
              </span>
            </Button>
            <Button
              variant="ghost"
              className="flex flex-col items-start justify-start p-5 h-auto bg-gray-50 hover:bg-gray-100 border border-transparent hover:border-gray-200 rounded-3xl"
              onClick={handleFeatureClick}
            >
              <Calendar className="h-6 w-6 mb-2 text-gray-600" />
              <span className="text-gray-700 text-sm">
                {t("createTaskReminder")}
              </span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
