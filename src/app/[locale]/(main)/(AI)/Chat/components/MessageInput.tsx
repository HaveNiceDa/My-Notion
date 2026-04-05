"use client";

import {
  Plus,
  Settings,
  Send,
  Bot,
  Check,
  Database,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Textarea } from "@/src/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/src/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/src/lib/utils";
import {
  useAIModelStore,
  AI_MODELS,
  AIModel,
} from "@/src/lib/store/use-ai-model-store";
import { MODEL_DISPLAY_NAMES } from "@/src/lib/ai/config";
import { useKnowledgeBaseStore } from "@/src/lib/store/use-knowledge-base-store";
import { useState, memo, useRef, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useImageUpload } from "@/src/hooks/use-image-upload";

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: (images?: string[]) => Promise<void>;
  onGetImages?: () => string[];
  className?: string;
  conversationId?: string | null;
}

const MessageInput = memo(
  ({
    input,
    onInputChange,
    onSend,
    onGetImages,
    className,
  }: MessageInputProps) => {
    const t = useTranslations("AI");
    const { model, setModel } = useAIModelStore();
    const { enabled: knowledgeBaseEnabled, toggle: toggleKnowledgeBase } =
      useKnowledgeBaseStore();
    const [isSending, setIsSending] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {
      uploadingFiles,
      uploadFiles,
      cancelUpload,
      removeFile,
      getCompletedFiles,
      clearFiles,
    } = useImageUpload(t);

    // 暴露获取已完成上传图片的方法给父组件
    useEffect(() => {
      if (onGetImages) {
        onGetImages();
      }
    }, [uploadingFiles, onGetImages]);

    const getModelDisplayName = useMemoizedFn((modelName: AIModel) => {
      return MODEL_DISPLAY_NAMES[modelName] || modelName;
    });

    const handleSend = useMemoizedFn(async () => {
      if (isSending || (!input.trim() && getCompletedFiles().length === 0)) {
        if (isSending) {
          toast.info(t("messageSendingInProgress"));
        }
        return;
      }
      setIsSending(true);
      try {
        const images = getCompletedFiles();
        await onSend(images);
        clearFiles();
      } finally {
        setIsSending(false);
      }
    });

    const handleKeyPress = useMemoizedFn(
      (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      },
    );

    const handleInputChange = useMemoizedFn(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onInputChange(e.target.value);
      },
    );

    const handleFileClick = useMemoizedFn(() => {
      fileInputRef.current?.click();
    });

    const handleFileChange = useMemoizedFn(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
          uploadFiles(files);
          e.target.value = "";
        }
      },
    );

    const handleRemoveFile = useMemoizedFn((id: string) => {
      removeFile(id);
    });

    const handleCancelUpload = useMemoizedFn((id: string) => {
      cancelUpload(id);
    });

    const handlePaste = useMemoizedFn(
      (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const files: File[] = [];
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) {
              files.push(file);
            }
          }
        }

        if (files.length > 0) {
          e.preventDefault();
          uploadFiles(files);
        }
      },
    );

    const hasUploadingFiles = uploadingFiles.length > 0;

    return (
      <div className="border border-border rounded-2xl shadow-sm bg-background pt-4 px-4 pb-1">
        {hasUploadingFiles && (
          <div className="mb-2 flex flex-wrap gap-2">
            {uploadingFiles.slice(0, 10).map((file) => (
              <div key={file.id} className="flex items-center">
                {file.status === "uploading" && (
                  <div className="relative w-12 h-12 rounded-md bg-muted flex items-center justify-center overflow-visible">
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    <div className="absolute inset-0 rounded-md bg-black/30 flex items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {file.progress}%
                      </span>
                      <button
                        onClick={() => handleCancelUpload(file.id)}
                        className="absolute -top-2 -right-2 text-white hover:text-red-200 bg-black/50 rounded-full p-0.5 opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                {file.status === "completed" && (
                  <div className="relative w-12 h-12 rounded-md overflow-visible group">
                    <img
                      src={file.url || ""}
                      alt={file.file.name}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="absolute -top-2 -right-2 bg-black/50 text-white hover:bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {file.status === "error" && (
                  <div className="relative w-12 h-12 rounded-md bg-red-100 flex items-center justify-center overflow-visible group">
                    <ImageIcon className="h-6 w-6 text-red-500" />
                    <button
                      onClick={() => handleRemoveFile(file.id)}
                      className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-red-100 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {file.error && (
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-red-500">{file.error}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Textarea
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          onPaste={handlePaste}
          placeholder={t("useAIToHandleTasks")}
          className={cn(
            "w-full px-0 py-0 !border-0 !shadow-none rounded-none focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[80px] text-lg overflow-y-auto resize-none bg-transparent",
            isSending && "opacity-90",
            className,
          )}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex items-center justify-between -ml-2">
          <div className="flex items-center gap-1">
            <Button
              className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
              onClick={handleFileClick}
              disabled={isSending}
            >
              <Plus className="h-5 w-5" />
            </Button>
            <Button
              className="bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0"
              onClick={() => toast.info(t("featureUnderDevelopment"))}
              disabled={isSending}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip delayDuration={1}>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      "rounded-full transition-all duration-200 h-9 w-9 p-0 bg-transparent",
                      knowledgeBaseEnabled
                        ? "hover:bg-blue-200 text-blue-600"
                        : "hover:bg-muted text-muted-foreground",
                      isSending && "opacity-50",
                    )}
                    onClick={() => {
                      if (!isSending) {
                        toggleKnowledgeBase();
                        toast.info(
                          knowledgeBaseEnabled
                            ? t("knowledgeBaseDisabled")
                            : t("knowledgeBaseEnabled"),
                        );
                      }
                    }}
                    title={
                      knowledgeBaseEnabled
                        ? t("knowledgeBaseEnabled")
                        : t("knowledgeBaseDisabled")
                    }
                    disabled={isSending}
                  >
                    <Database className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("knowledgeBaseTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  className="hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0 bg-transparent"
                  variant="ghost"
                  disabled={isSending}
                >
                  <Bot className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {AI_MODELS.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    onClick={() => setModel(m)}
                    className={cn(
                      "cursor-pointer flex items-center justify-between",
                      model === m && "bg-muted font-medium",
                    )}
                  >
                    <span>{getModelDisplayName(m)}</span>
                    {model === m && <Check className="h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              onClick={handleSend}
              disabled={
                (!input.trim() && getCompletedFiles().length === 0) || isSending
              }
              className={cn(
                "bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0",
                isSending && "opacity-70",
              )}
            >
              {isSending ? (
                <div className="w-5 h-5 animate-spin rounded-full border-b-2 border-blue-600"></div>
              ) : (
                <Send className="h-5 w-5 rounded-full" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

MessageInput.displayName = "MessageInput";

export { MessageInput };
