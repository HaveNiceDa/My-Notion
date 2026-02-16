"use client";

import { MessageSquare, FileText, Calendar, Send, File } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { toast } from "sonner";

interface NewConversationLandingProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  todayIWillHelpText: string;
  useAIToHandleTasksText: string;
  notionAIText: string;
  writeMeetingAgendaText: string;
  analyzePDFOrImageText: string;
  createTaskReminderText: string;
  featureUnderDevelopmentText: string;
}

export const NewConversationLanding = ({
  input,
  onInputChange,
  onSend,
  onKeyPress,
  todayIWillHelpText,
  useAIToHandleTasksText,
  notionAIText,
  writeMeetingAgendaText,
  analyzePDFOrImageText,
  createTaskReminderText,
  featureUnderDevelopmentText,
}: NewConversationLandingProps) => {
  const handleFeatureClick = () => {
    toast.info(featureUnderDevelopmentText);
  };

  return (
    <div className="flex-1 flex flex-col bg-white px-8">
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center max-w-md">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-bold">N</span>
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-gray-900 mb-8">
            {todayIWillHelpText}
          </h1>

          <div className="relative mb-6 w-full">
            <Input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder={useAIToHandleTasksText}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent pr-12"
            />
            <Button
              onClick={onSend}
              disabled={!input.trim()}
              className="absolute left-[100%] top-1/2 transform translate-x-[-100%] -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
              onClick={handleFeatureClick}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span>{notionAIText}</span>
            </Button>
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
              onClick={handleFeatureClick}
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>{writeMeetingAgendaText}</span>
            </Button>
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
              onClick={handleFeatureClick}
            >
              <File className="h-4 w-4 mr-2" />
              <span>{analyzePDFOrImageText}</span>
            </Button>
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
              onClick={handleFeatureClick}
            >
              <Calendar className="h-4 w-4 mr-2" />
              <span>{createTaskReminderText}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
