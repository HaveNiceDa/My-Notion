"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Check, Copy, Globe, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { useUser } from "@clerk/clerk-react";

import { Doc } from "@/convex/_generated/dataModel";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/src/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/src/components/ui/tooltip";
import { useOrigin } from "@/src/hooks/use-origin";
import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/button";
import { formatTime } from "@/src/lib/utils";

interface PublishProps {
  initialData: Doc<"documents">;
}

export function Publish({ initialData }: PublishProps) {
  const origin = useOrigin();
  const update = useMutation(api.documents.update);
  const toggleStarDoc = useMutation(api.documents.toggleStar);
  const t = useTranslations("Publish");
  const { user, isLoaded: isUserLoaded } = useUser();

  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarred, setIsStarred] = useState(initialData.isStarred || false);

  const url = `${origin}/preview/${initialData._id}`;



  const lastEditedTime = formatTime(
    initialData.lastEditedTime || initialData._creationTime,
    t
  );
  const createdTime = formatTime(initialData._creationTime, t);

  // 获取当前用户名（从Clerk获取）
  const getCurrentUserName = () => {
    if (!isUserLoaded) return "Loading...";
    return (
      user?.fullName || user?.emailAddresses?.[0]?.emailAddress || "Unknown"
    );
  };

  const creatorName = getCurrentUserName();
  const editorName = getCurrentUserName();

  const onPublish = () => {
    setIsSubmitting(true);

    const promise = update({
      id: initialData._id,
      isPublished: true,
    }).finally(() => setIsSubmitting(false));

    toast.promise(promise, {
      loading: t("publishing"),
      success: t("notePublished"),
      error: t("errorToPublishNote"),
    });
  };

  const onUnPublish = () => {
    setIsSubmitting(true);

    const promise = update({
      id: initialData._id,
      isPublished: false,
    }).finally(() => setIsSubmitting(false));

    toast.promise(promise, {
      loading: t("unpublishing"),
      success: t("noteUnpublished"),
      error: t("errorToUnpublishNote"),
    });
  };

  const onCopy = () => {
    navigator.clipboard.writeText(url);

    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 1000);
  };

  const toggleStar = async () => {
    setIsSubmitting(true);
    try {
      await toggleStarDoc({
        id: initialData._id,
        isStarred: !isStarred,
      });
      setIsStarred(!isStarred);
      toast.success(
        !isStarred
          ? t('starredSuccess')
          : t('unstarredSuccess')
      );
    } catch (error) {
      toast.error(t('errorToToggleStar'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex items-center gap-x-2">
        {!isUserLoaded ? (
          <span className="text-xs text-muted-foreground px-2 py-1 rounded-md">
            {t("loading")}...
          </span>
        ) : lastEditedTime ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-pointer px-2 py-1 rounded-md transition-colors hover:bg-muted">
                {t("lastEdited")} {lastEditedTime}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="text-xs">
                  {t("createdBy", {
                    user: creatorName,
                    time: createdTime ?? "",
                  })}
                </p>
                <p className="text-xs">
                  {t("editedBy", { user: editorName, time: lastEditedTime })}
                </p>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-xs text-muted-foreground px-2 py-1 rounded-md">
            {t("loading")}...
          </span>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost">
              {t("publish")}
              {initialData.isPublished && (
                <Globe className="text-sky-500 w-4 h-4 ml-2" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-72"
            align="end"
            alignOffset={8}
            forceMount
          >
            {initialData.isPublished ? (
              <div className="space-y-4">
                <div className="flex gap-x-2 items-center">
                  <Globe className="text-sky-500 animate-pulse w-4 h-4" />
                  <p className="text-xs font-medium text-sky-500">
                    {t("thisNoteLiveOnWeb")}
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    className="flex-1 px-2 text-xs border rounded-l-md h-8 bg-muted truncate"
                    value={url}
                    disabled
                  />
                  <Button
                    className="h-8 rounded-l-none"
                    onClick={onCopy}
                    disabled={copied}
                  >
                    {copied ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <Button
                  className="w-full text-xs"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={onUnPublish}
                >
                  {t("unpublish")}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center">
                <Globe className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-2">
                  {t("publishThisNote")}
                </p>
                <span className="text-xs text-muted-foreground mb-4">
                  {t("shareYourWorkWithOthers")}
                </span>
                <Button
                  className="w-full text-xs"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={onPublish}
                >
                  {t("publish")}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          variant="ghost"
          disabled={isSubmitting}
          onClick={toggleStar}
        >
          <Star
            className={`w-4 h-4 ml-2 ${isStarred ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground'}`}
          />
        </Button>
      </div>
    </TooltipProvider>
  );
}
