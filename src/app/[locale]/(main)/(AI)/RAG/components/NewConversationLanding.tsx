"use client";

import { MessageSquare, FileText, Calendar, Send } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

interface NewConversationLandingProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  todayIWillHelpText: string;
  useAIToHandleTasksText: string;
  notionAIText: string;
}

export const NewConversationLanding = ({
  input,
  onInputChange,
  onSend,
  onKeyPress,
  todayIWillHelpText,
  useAIToHandleTasksText,
  notionAIText,
}: NewConversationLandingProps) => {
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

          <div className="relative mb-6">
            <Input
              type="text"
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyPress={onKeyPress}
              placeholder={useAIToHandleTasksText}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <Button
              onClick={onSend}
              disabled={!input.trim()}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-gray-200 hover:bg-gray-300 text-gray-800"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              <span>{notionAIText}</span>
            </Button>
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>撰写会议议程</span>
            </Button>
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
            >
              <FileText className="h-4 w-4 mr-2" />
              <span>分析 PDF 或图片</span>
            </Button>
            <Button
              variant="ghost"
              className="border border-gray-200 rounded-lg p-3 justify-start text-left"
            >
              <Calendar className="h-4 w-4 mr-2" />
              <span>创建任务提醒器</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};