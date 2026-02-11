"use client";

import React, { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";

import { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";

interface TitleProps {
  initialData: Doc<"documents">;
}

export function Title({ initialData }: TitleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const update = useMutation(api.documents.update);
  const documentPath = useQuery(api.documents.getDocumentPath, {
    documentId: initialData._id,
  });

  const [title, setTitle] = useState(initialData.title || "Untitled");
  const [isEditing, setIsEditing] = useState(false);

  const enableInput = () => {
    setTitle(initialData.title);
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(0, inputRef.current.value.length);
    }, 0);
  };

  const disableInput = () => {
    setIsEditing(false);
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(event.target.value);

    update({
      id: initialData._id,
      title: event.target.value || "Untitled",
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      disableInput();
    }
  };

  const handleBreadcrumbClick = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  return (
    <div className="flex gap-x-1 items-center">
      {!!initialData.icon && <p>{initialData.icon}</p>}

      {/* 面包屑导航 */}
      {documentPath && documentPath.length > 1 && (
        <div className="flex items-center gap-x-1 mr-2">
          {documentPath.map((doc, index) => {
            const isLast = index === documentPath.length - 1;
            return (
              <React.Fragment key={doc._id}>
                {!isLast ? (
                  <>
                    <Button
                      className="font-normal h-auto p-1 text-sm text-muted-foreground hover:text-foreground"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleBreadcrumbClick(doc._id)}
                    >
                      <span className="truncate max-w-[120px]">{doc.title}</span>
                    </Button>
                    <span className="text-muted-foreground">/</span>
                  </>
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* 当前文档标题 */}
      {isEditing ? (
        <Input
          className="h-7 px-2 focus-visible:ring-transparent"
          ref={inputRef}
          onClick={enableInput}
          onBlur={disableInput}
          value={title}
          onChange={onChange}
          onKeyDown={onKeyDown}
        />
      ) : (
        <Button
          className="font-normal h-auto p-1"
          variant="ghost"
          size="sm"
          onClick={enableInput}
        >
          <span className="truncate text-muted-foreground">{initialData?.title}</span>
        </Button>
      )}
    </div>
  );
}

Title.Skeleton = function TitleSkeleton() {
  return <Skeleton className="w-20 h-8 rounded-md" />;
};
