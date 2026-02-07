"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import { use, useMemo, useRef, useState } from "react";
import { useTitle } from "@/src/hooks/use-title";
import { useTranslations } from "next-intl";
import type { EditorRef } from "@/src/components/Editor";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/src/components/Toolbar";
import { Cover } from "@/src/components/Cover";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ErrorModal } from "@/src/components/modals/error-modal";
import Editor from "@/src/components/Editor";
import { Room } from "@/src/components/Room";

interface DocumentIdPageProps {
  params: Promise<{
    documentId: Id<"documents">;
  }>;
}

export default function DocumentIdPage({ params }: DocumentIdPageProps) {
  const { documentId } = use(params) as { documentId: Id<"documents"> };
  const t = useTranslations("Error");

  const document = useQuery(api.documents.getById, {
    documentId,
  });

  const update = useMutation(api.documents.update);

  const editorRef = useRef<EditorRef>(null);

  // 错误提示模态对话框状态
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalDescription, setErrorModalDescription] = useState("");

  // 将浏览器标题设置为文档标题
  useTitle(document?.title);

  const onChange = (content: string) => {
    update({
      id: documentId,
      content,
    });
  };

  const handleEnter = () => {
    editorRef.current?.focus();
  };

  // 处理拖拽到文档详情页的逻辑
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到编辑器
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止事件冒泡到编辑器
    // 检查是否是文档拖拽
    const documentId = e.dataTransfer.getData("text/plain");
    if (documentId) {
      // 显示错误提示，因为不能将文档移动到文档详情页
      setErrorModalTitle(t("dragErrorTitle"));
      setErrorModalDescription(t("dragErrorDescription"));
      setErrorModalOpen(true);
    }
  };

  if (document === undefined) {
    return (
      <div>
        <Cover.Skeleton />
        <div className="md:max-w-3xl lg:max-w-4xl mx-auto mt-10">
          <div className="space-y-4 pl-8 pt-4">
            <Skeleton className="h-14 w-[50%]" />
            <Skeleton className="h-14 w-[80%]" />
            <Skeleton className="h-14 w-[40%]" />
            <Skeleton className="h-14 w-[60%]" />
          </div>
        </div>
      </div>
    );
  }

  if (document === null) {
    return <div>Not Found</div>;
  }

  return (
    <div className="pb-40" onDragOver={handleDragOver} onDrop={handleDrop}>
      <Cover url={document.coverImage} />
      <div className="md:max-w-3xl lg:md-max-w-4xl mx-auto">
        <Toolbar initialData={document} onEnter={handleEnter} />
        <Room>
          <Editor
            ref={editorRef}
            onChange={onChange}
            initialContent={document.content}
          />
        </Room>
      </div>

      {/* 错误提示模态对话框 */}
      <ErrorModal
        open={errorModalOpen}
        onOpenChange={setErrorModalOpen}
        title={errorModalTitle}
        description={errorModalDescription}
      />
    </div>
  );
}
