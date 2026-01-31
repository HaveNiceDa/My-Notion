"use client";

import React, { useRef, useState } from "react";
import { ImageIcon, Smile, X } from "lucide-react";
import { useMutation } from "convex/react";
import TextAreaAutoSize from "react-textarea-autosize";
import { useTranslations } from "next-intl";

import { useConverImage } from "@/src/hooks/use-cover-image";
import { Doc } from "@/convex/_generated/dataModel";
import { Button } from "@/src/components/ui/button";
import { api } from "@/convex/_generated/api";

import { IconPicker } from "./icon-picker";

interface ToolbarProps {
  initialData: Doc<"documents">;
  preview?: boolean;
  onEnter?: () => void;
}

export function Toolbar({ initialData, preview, onEnter }: ToolbarProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialData.title);
  const t = useTranslations("Toolbar");

  const update = useMutation(api.documents.update);
  const removeIcon = useMutation(api.documents.removeIcon);

  const coverImage = useConverImage();

  const enableInput = (e: React.MouseEvent<HTMLDivElement>) => {
    if (preview) return;

    // 计算点击位置
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // 创建一个临时范围来计算光标位置
    const range = document.createRange();

    // 尝试找到点击位置的文本节点
    let closestNode = target;
    while (closestNode && closestNode.firstChild) {
      closestNode = closestNode.firstChild as HTMLDivElement;
    }

    let position: number | null = null;

    if (closestNode && closestNode.nodeType === Node.TEXT_NODE) {
      range.setStart(closestNode, 0);
      range.setEnd(closestNode, closestNode.textContent?.length || 0);

      // 计算光标位置
      const rangeRect = range.getBoundingClientRect();
      const textLength = closestNode.textContent?.length || 0;

      // 简单的线性近似来计算光标位置
      if (rangeRect.width > 0) {
        position = Math.min(
          Math.round((x / rangeRect.width) * textLength),
          textLength,
        );
      }
    }

    setIsEditing(true);
    setTimeout(() => {
      const input = inputRef.current;
      if (input) {
        input.focus();
        // 设置光标位置
        if (position !== null) {
          input.setSelectionRange(position, position);
        }
      }
    }, 0);
  };

  const disableInput = () => setIsEditing(false);

  const onInput = (value: string) => {
    setValue(value);
    update({
      id: initialData._id,
      title: value || "Untitled",
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      disableInput();
      onEnter?.();
    }
  };

  const onIconSelect = (icon: string) => {
    update({
      id: initialData._id,
      icon,
    });
  };

  const onRemoveIcon = () => {
    removeIcon({
      id: initialData._id,
    });
  };

  return (
    <div className="pl-[54px] group relative">
      {!!initialData.icon && !preview && (
        <div className="flex gap-x-2 items-center group/icon pt-6">
          <IconPicker onChange={onIconSelect}>
            <p className="text-6xl hover:opacity-75 transition">
              {initialData.icon}
            </p>
          </IconPicker>
          <Button
            className="rounded-full opacity-0 group-hover/icon:opacity-100 transition
          text-muted-foreground text-xs"
            variant="outline"
            size="icon"
            onClick={onRemoveIcon}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      {!!initialData.icon && preview && (
        <p className="text-6xl pt-6">{initialData.icon}</p>
      )}
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-x-1 py-4">
        {!initialData.icon && !preview && (
          <IconPicker asChild onChange={onIconSelect}>
            <Button
              className="text-muted-foreground text-xs"
              variant="outline"
              size="sm"
            >
              <Smile className="w-4 h-4 mr-2" />
              {t("addIcon")}
            </Button>
          </IconPicker>
        )}
        {!initialData.coverImage && !preview && (
          <Button
            className="text-muted-foreground text-xs"
            variant="outline"
            size="sm"
            onClick={coverImage.onOpen}
          >
            <ImageIcon className="w-4 h-4 mr-2" />
            {t("addCover")}
          </Button>
        )}
      </div>
      {isEditing && !preview ? (
        <TextAreaAutoSize
          className="text-5xl bg-transparent font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF]
        resize-none"
          ref={inputRef}
          onBlur={disableInput}
          onKeyDown={onKeyDown}
          value={value}
          onChange={(e) => onInput(e.target.value)}
        />
      ) : (
        <div
          ref={titleRef}
          className="pb-[11.5px] text-5xl font-bold break-words outline-none text-[#3F3F3F] dark:text-[#CFCFCF]"
          onClick={enableInput}
        >
          {initialData.title}
        </div>
      )}
    </div>
  );
}
