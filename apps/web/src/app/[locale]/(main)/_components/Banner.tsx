"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/button";
import { ConfirmModal } from "@/src/components/modals/confirm-modal";

interface BannerProps {
  documentId: Id<"documents">;
}

export function Banner({ documentId }: BannerProps) {
  const router = useRouter();
  const t = useTranslations("Banner");

  const remove = useMutation(api.documents.remove);
  const restore = useMutation(api.documents.restore);

  const onRemove = () => {
    const promise = remove({ id: documentId });

    toast.promise(promise, {
      loading: t('deletingNote'),
      success: t('noteDeleted'),
      error: t('failedToDeleteNote'),
    });

    router.push("/documents");
  };

  const onRestore = () => {
    const promise = restore({ id: documentId });

    toast.promise(promise, {
      loading: t('restoringNote'),
      success: t('noteRestored'),
      error: t('failedToRestoreNote'),
    });
  };

  return (
    <div className="w-full bg-rose-500 text-center text-sm p-2 text-white flex gap-x-2 justify-center items-center">
      <p>{t('pageInTrash')}</p>
      <Button
        className="border-white bg-transparent hover:bg-primary/5 text-white hover:text-white p-1 px-2
      h-auto font-normal"
        variant="outline"
        size="sm"
        onClick={onRestore}
      >
        {t('restorePage')}
      </Button>
      <ConfirmModal onConfirm={onRemove}>
        <Button
          className="border-white bg-transparent hover:bg-primary/5 text-white hover:text-white p-1 px-2
      h-auto font-normal"
          variant="outline"
          size="sm"
        >
          {t('deleteForever')}
        </Button>
      </ConfirmModal>
    </div>
  );
}
