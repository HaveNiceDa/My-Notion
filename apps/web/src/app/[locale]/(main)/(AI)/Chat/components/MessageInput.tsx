"use client";

import {
  Plus,
  Send,
  Bot,
  Check,
  Database,
  X,
  Image as ImageIcon,
  Brain,
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
import { useDeepThinkingStore } from "@/src/lib/store/use-deep-thinking-store";
import { useState, memo, useRef, useEffect } from "react";
import { useMemoizedFn } from "ahooks";
import { useImageUpload } from "@/src/hooks/use-image-upload";
import { validateFiles, validateImageFile } from "../utils";

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
    const { enabled: deepThinkingEnabled, toggle: toggleDeepThinking } =
      useDeepThinkingStore();
    const [isSending, setIsSending] = useState(false);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const {
      uploadingFiles,
      uploadFiles,
      cancelUpload,
      removeFile,
      getCompletedFiles,
      clearFiles,
    } = useImageUpload(t);

    useEffect(() => {
      if (onGetImages) {
        onGetImages();
      }
    }, [uploadingFiles, onGetImages]);

    const getModelDisplayName = useMemoizedFn((modelName: AIModel) => {
      return MODEL_DISPLAY_NAMES[modelName] || modelName;
    });

    const hasAnyFiles = uploadingFiles.length > 0;
    const hasUploadingFiles = uploadingFiles.some(
      (f) => f.status === "uploading",
    );

    const handleSend = useMemoizedFn(async () => {
      if (
        isSending ||
        hasUploadingFiles ||
        (!input.trim() && getCompletedFiles().length === 0)
      ) {
        if (isSending) {
          toast.info(t("messageSendingInProgress"));
        }
        if (hasUploadingFiles) {
          toast.info(t("pleaseWaitForImageUpload"));
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
          const { validFiles, invalidFiles } = validateFiles(
            files,
            t("unsupportedFileType"),
          );
          if (invalidFiles.length > 0) {
            toast.error(t("unsupportedFileType"));
          }
          if (validFiles.length > 0) {
            uploadFiles(validFiles);
          }
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
              const validation = validateImageFile(
                file,
                t("unsupportedFileType"),
              );
              if (validation.valid) {
                files.push(file);
              } else if (validation.error) {
                toast.error(t("unsupportedFileType"));
              }
            }
          }
        }

        if (files.length > 0) {
          e.preventDefault();
          uploadFiles(files);
        }
      },
    );

    const renderImagePreview = () => {
      if (!previewImageUrl) return null;

      return (
        <div
          className="fixed inset-0 z-[99999] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewImageUrl(null)}
        >
          <button
            onClick={() => setPreviewImageUrl(null)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <X className="h-8 w-8" />
          </button>
          <img
            src={previewImageUrl}
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      );
    };

    return (
      <div className="border border-border rounded-2xl shadow-sm bg-background pt-4 px-4 pb-1">
        {hasAnyFiles && (
          <div className="mb-2 flex flex-wrap gap-2">
            {uploadingFiles.slice(0, 10).map((file) => (
              <div key={file.id} className="flex items-center">
                {file.status === "uploading" && (
                  <div className="relative w-12 h-12 rounded-md overflow-visible">
                    <img
                      src={file.previewUrl}
                      alt={file.file.name}
                      className="w-full h-full object-cover rounded-md"
                    />
                    <div className="absolute inset-0 rounded-md bg-black/40 flex flex-col items-center justify-center">
                      <span className="text-white text-sm font-medium">
                        {file.progress}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelUpload(file.id);
                        }}
                        className="absolute -top-2 -right-2 text-white hover:text-red-200 bg-black/50 rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
                {file.status === "completed" && (
                  <div className="relative w-12 h-12 rounded-md overflow-visible group cursor-pointer">
                    <div
                      className="w-full h-full"
                      onClick={() => setPreviewImageUrl(file.previewUrl)}
                    >
                      <img
                        src={file.previewUrl}
                        alt={file.file.name}
                        className="w-full h-full object-cover rounded-md"
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file.id);
                      }}
                      className="absolute -top-2 -right-2 bg-black/50 text-white hover:bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {file.status === "error" && (
                  <div className="relative w-12 h-12 rounded-md overflow-visible group">
                    <img
                      src={file.previewUrl}
                      alt={file.file.name}
                      className="w-full h-full object-cover rounded-md opacity-50"
                    />
                    <div className="absolute inset-0 rounded-md bg-red-500/30 flex items-center justify-center">
                      <ImageIcon className="h-4 w-4 text-white" />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(file.id);
                      }}
                      className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10"
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
            <TooltipProvider>
              <Tooltip delayDuration={1}>
                <TooltipTrigger asChild>
                  <Button
                    className={cn(
                      "rounded-full transition-all duration-200 h-9 w-9 p-0 bg-transparent",
                      deepThinkingEnabled
                        ? "hover:bg-purple-200 text-purple-600"
                        : "hover:bg-muted text-muted-foreground",
                      isSending && "opacity-50",
                    )}
                    onClick={() => {
                      if (!isSending) {
                        toggleDeepThinking();
                        toast.info(
                          deepThinkingEnabled
                            ? t("deepThinkingDisabled")
                            : t("deepThinkingEnabled"),
                        );
                      }
                    }}
                    title={
                      deepThinkingEnabled
                        ? t("deepThinkingEnabled")
                        : t("deepThinkingDisabled")
                    }
                    disabled={isSending}
                  >
                    <Brain className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t("deepThinkingTooltip")}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
              <TooltipProvider>
                <Tooltip delayDuration={1}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        className="hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0 bg-transparent"
                        variant="ghost"
                        disabled={isSending}
                      >
                        <Bot className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{t("modelSelect")}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
                (!input.trim() && getCompletedFiles().length === 0) ||
                isSending ||
                hasUploadingFiles
              }
              className={cn(
                "bg-transparent hover:bg-muted text-foreground rounded-full transition-all duration-200 h-9 w-9 p-0",
                (isSending || hasUploadingFiles) && "opacity-70",
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
        {renderImagePreview()}
      </div>
    );
  },
);

MessageInput.displayName = "MessageInput";

export { MessageInput };
