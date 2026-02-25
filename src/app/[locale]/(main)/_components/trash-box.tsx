"use client";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { Search, Trash, Undo, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Spinner } from "@/src/components/spinner";
import { Input } from "@/src/components/ui/input";
import { Checkbox } from "@/src/components/ui/checkbox";
import { Button } from "@/src/components/ui/button";
import { ConfirmModal } from "@/src/components/modals/confirm-modal";

export function TrashBox() {
  const router = useRouter();
  const params = useParams();
  const documents = useQuery(api.documents.getTrash);
  const restore = useMutation(api.documents.restore);
  const remove = useMutation(api.documents.remove);
  const batchRemove = useMutation(api.documents.batchRemove);
  const t = useTranslations("TrashBox");

  const [search, setSearch] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Set<Id<"documents">>>(new Set());

  const filteredDocuments = documents?.filter((document) => {
    return document.title.toLowerCase().includes(search.toLocaleLowerCase());
  });

  const onClick = (documentId: string) => {
    router.push(`/documents/${documentId}`);
  };

  const onRestore = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    documentId: Id<"documents">,
  ) => {
    event.stopPropagation();

    const promise = restore({ id: documentId });

    toast.promise(promise, {
        loading: t('restoringNote'),
        success: t('noteRestored'),
        error: t('failedToRestoreNote'),
      });
  };

  const onRemove = (documentId: Id<"documents">) => {
    const promise = remove({ id: documentId });

    toast.promise(promise, {
        loading: t('deletingNote'),
        success: t('noteDeleted'),
        error: t('failedToDeleteNote'),
      });
    if (params.documentId === documentId) {
      router.push("/documents");
    }
  };

  const toggleSelectDocument = (documentId: Id<"documents">) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(documentId)) {
        newSet.delete(documentId);
      } else {
        newSet.add(documentId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDocuments.size === (filteredDocuments?.length || 0)) {
      setSelectedDocuments(new Set());
    } else {
      setSelectedDocuments(new Set(filteredDocuments?.map(doc => doc._id) || []));
    }
  };

  const handleBatchRemove = () => {
    const selectedIds = Array.from(selectedDocuments);
    if (selectedIds.length === 0) return;

    const promise = batchRemove({ ids: selectedIds });

    toast.promise(promise, {
      loading: t('deletingNote'),
      success: () => {
        setSelectedDocuments(new Set());
        return t('noteDeleted');
      },
      error: t('failedToDeleteNote'),
    });

    // 如果当前打开的文档被删除，跳转到文档列表
    if (params.documentId && selectedDocuments.has(params.documentId as Id<"documents">)) {
      router.push("/documents");
    }
  };

  if (documents === undefined) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="text-sm">
      <div className="flex items-center gap-x-1 p-2">
        <Search className="w-4 h-4" />
        <Input
          className="h-7 px-2 focus-visible:ring-transparent bg-secondary flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('filterByPageTitle')}
        />
      </div>
      {filteredDocuments && filteredDocuments.length > 0 && (
        <div className="flex items-center justify-between px-2 py-2 border-b">
          <div className="flex items-center">
            <Checkbox
              checked={selectedDocuments.size === filteredDocuments.length && filteredDocuments.length > 0}
              onCheckedChange={toggleSelectAll}
              className="mr-3"
            />
            <span className="text-xs text-muted-foreground">
              {selectedDocuments.size} / {filteredDocuments.length} {t('selected')}
            </span>
          </div>
          <Button 
            size="sm" 
            variant="destructive" 
            disabled={selectedDocuments.size === 0}
            onClick={handleBatchRemove}
            className="text-xs px-2 py-1 h-7"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            {t('batchDelete')}
          </Button>
        </div>
      )}
      <div className="mt-2 px-1 pb-1">
        <p className="hidden last:block text-xs text-center text-muted-foreground pb-2">
            {t('noDocumentsFound')}
          </p>
        {filteredDocuments?.map((document) => (
          <div
            className={`text-sm rounded-sm w-full hover:bg-primary/5 flex items-center text-primary ${selectedDocuments.has(document._id) ? 'bg-primary/10' : ''} py-2 px-2`}
            key={document._id}
          >
            <Checkbox
              checked={selectedDocuments.has(document._id)}
              onCheckedChange={() => toggleSelectDocument(document._id)}
              className="mr-3 flex-shrink-0"
            />
            <span 
              className="truncate flex-1"
              role="button"
              onClick={() => onClick(document._id)}
            >
              {document.title}
            </span>
            <div className="flex items-center gap-x-1 ml-2">
              <div
                className="rounded-sm p-1.5 hover:bg-neutral-200 
              dark:hover:bg-neutral-600 transition-colors"
                onClick={(e) => onRestore(e, document._id)}
                title="恢复"
              >
                <Undo className="w-4 h-4 text-muted-foreground" />
              </div>
              <ConfirmModal onConfirm={() => onRemove(document._id)}>
                <div
                  className="rounded-sm p-1.5 hover:bg-neutral-200
                dark:hover:bg-neutral-600 transition-colors"
                  role="button"
                  title="删除"
                >
                  <Trash className="w-4 h-4 text-muted-foreground" />
                </div>
              </ConfirmModal>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
