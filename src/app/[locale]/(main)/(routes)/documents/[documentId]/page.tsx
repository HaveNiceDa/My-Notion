"use client";

import { useMutation, useQuery } from "convex/react";
import dynamic from "next/dynamic";
import React, { use, useMemo, useRef, useState, useEffect } from "react";
import { useTitle } from "@/src/hooks/use-title";
import { useTranslations } from "next-intl";
import type { EditorRef } from "@/src/components/Editor";
import { useUser } from "@clerk/clerk-react";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Toolbar } from "@/src/components/Toolbar";
import { Cover } from "@/src/components/Cover";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ErrorModal } from "@/src/components/modals/error-modal";
import { getDocumentWatcher } from "@/src/lib/rag/DocumentWatcher";
import { triggerDocumentUpdate } from "@/src/lib/rag/rag";

const Editor = dynamic(() => import("@/src/components/Editor"), {
  ssr: false,
});

interface DocumentIdPageProps {
  params: Promise<{
    documentId: Id<"documents">;
  }>;
}

// 简单的内存缓存
const documentCache = new Map<string, any>();

export default function DocumentIdPage({ params }: DocumentIdPageProps) {
  const { documentId } = use(params) as { documentId: Id<"documents"> };
  const t = useTranslations("Error");
  const { user } = useUser();

  const document = useQuery(api.documents.getById, {
    documentId,
  });

  // 缓存文档数据
  React.useMemo(() => {
    if (document) {
      documentCache.set(documentId, document);
    }
  }, [document, documentId]);

  const update = useMutation(api.documents.update);

  const editorRef = useRef<EditorRef>(null);
  const watcherRef = useRef<any>(null);
  const updateDebounceRef = useRef<{ timer: NodeJS.Timeout | null; pendingUpdate: { id: Id<'documents'>; content: string } | null }>({ timer: null, pendingUpdate: null });

  // 防抖处理的更新函数
  const debouncedUpdate = (id: Id<'documents'>, content: string) => {
    // 清除之前的定时器
    if (updateDebounceRef.current.timer) {
      clearTimeout(updateDebounceRef.current.timer);
    }

    // 保存待更新的数据
    updateDebounceRef.current.pendingUpdate = { id, content };

    // 设置新的定时器
    updateDebounceRef.current.timer = setTimeout(() => {
      if (updateDebounceRef.current.pendingUpdate) {
        const { id, content } = updateDebounceRef.current.pendingUpdate;
        update({ id, content });
        updateDebounceRef.current.pendingUpdate = null;
      }
    }, 1000); // 1秒防抖
  };

  // 强制更新所有待处理的更新
  const flushUpdates = () => {
    if (updateDebounceRef.current.pendingUpdate) {
      const { id, content } = updateDebounceRef.current.pendingUpdate;
      update({ id, content });
      updateDebounceRef.current.pendingUpdate = null;
    }
    if (updateDebounceRef.current.timer) {
      clearTimeout(updateDebounceRef.current.timer);
      updateDebounceRef.current.timer = null;
    }
  };

  // 错误提示模态对话框状态
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorModalTitle, setErrorModalTitle] = useState("");
  const [errorModalDescription, setErrorModalDescription] = useState("");

  // 将浏览器标题设置为文档标题
  useTitle(document?.title);

  // 初始化 DocumentWatcher
  useEffect(() => {
    if (!user) return;

    const watcher = getDocumentWatcher(5000, (docId, content, title) => {
      triggerDocumentUpdate(user.id, docId, content, title);
    });
    watcherRef.current = watcher;

    return () => {
      watcher.flush(documentId);
      flushUpdates(); // 组件卸载时强制更新
    };
  }, [user, documentId]);

  const onChange = (content: string) => {
    // 使用防抖更新
    debouncedUpdate(documentId, content);

    // 触发 RAG 更新（防抖处理）- 只有当文档在知识库中时才触发
    if (user && document && document.isInKnowledgeBase) {
      watcherRef.current?.onDocumentChange(documentId, content, document.title);
    }
  };

  const onTitleChange = (title: string) => {
    // 触发 RAG 更新（防抖处理）- 只有当文档在知识库中时才触发
    if (user && document && document.isInKnowledgeBase) {
      watcherRef.current?.onDocumentChange(documentId, document.content, title);
    }
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
        <Toolbar
          initialData={document}
          onEnter={handleEnter}
          onTitleChange={onTitleChange}
        />
        <Editor
          ref={editorRef}
          onChange={onChange}
          initialContent={document.content}
        />
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
