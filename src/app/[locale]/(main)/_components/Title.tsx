"use client";

import React, { useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { CornerDownRight } from "lucide-react";

import { Doc } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/src/components/ui/popover";

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
  const [showMore, setShowMore] = useState(false);

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
          {documentPath.length >= 4 ? (
            // 层级 >= 4 时，显示省略号展开功能
            <>
              {/* 显示前两层 */}
              {documentPath.slice(0, 2).map((doc, index) => (
                <React.Fragment key={doc._id}>
                  <Button
                    className="font-normal h-auto p-1 text-sm text-muted-foreground hover:text-foreground"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleBreadcrumbClick(doc._id)}
                    title={doc.title}
                  >
                    <span className="truncate max-w-[120px]">{doc.title}</span>
                  </Button>
                  <span className="text-muted-foreground">/</span>
                </React.Fragment>
              ))}

              {/* 省略号 */}
              <Popover open={showMore} onOpenChange={setShowMore}>
                <PopoverTrigger asChild>
                  <Button
                    className="font-normal h-auto p-1 text-sm text-muted-foreground hover:text-foreground"
                    variant="ghost"
                    size="sm"
                  >
                    ...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="flex flex-col gap-1">
                    {documentPath.slice(2, -1).map((doc, index) => {
                      const isFirst = index === 0;
                      return (
                        <Button
                          key={doc._id}
                          className="font-normal h-auto p-2 text-sm text-muted-foreground hover:text-foreground justify-start gap-2"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleBreadcrumbClick(doc._id);
                            setShowMore(false);
                          }}
                          title={doc.title}
                        >
                          {!isFirst && <CornerDownRight className="h-4 w-4" />}
                          <span className="truncate max-w-[200px]">{doc.title}</span>
                        </Button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground">/</span>
            </>
          ) : (
            // 层级 < 4 时，正常显示所有父文档
            documentPath.slice(0, -1).map((doc, index) => (
              <React.Fragment key={doc._id}>
                <Button
                  className="font-normal h-auto p-1 text-sm text-muted-foreground hover:text-foreground"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBreadcrumbClick(doc._id)}
                  title={doc.title}
                >
                  <span className="truncate max-w-[120px]">{doc.title}</span>
                </Button>
                <span className="text-muted-foreground">/</span>
              </React.Fragment>
            ))
          )}
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
          title={initialData?.title}
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
