"use client";

import { useRouter } from "next/navigation";
import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Id } from "@/convex/_generated/dataModel";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/src/components/ui/dropdown-menu";
import { api } from "@/convex/_generated/api";
import { Button } from "@/src/components/ui/button";
import { Skeleton } from "@/src/components/ui/skeleton";
import { RenameModal } from "@/src/components/modals/rename-modal";

interface MenuProps {
  documentId: Id<"documents">;
}

export function Menu({ documentId }: MenuProps) {
  const router = useRouter();
  const { user } = useUser();
  const t = useTranslations("Menu");

  const document = useQuery(api.documents.getById, { documentId });
  const archive = useMutation(api.documents.archive);
  const update = useMutation(api.documents.update);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  const onArchive = () => {
    const promise = archive({ id: documentId });

    toast.promise(promise, {
      loading: t("movingToTrash"),
      success: t("noteMovedToTrash"),
      error: t("failedToArchiveNote"),
    });
    router.push("/documents");
  };

  const handleRename = async (newTitle: string) => {
    const promise = update({ id: documentId, title: newTitle });

    toast.promise(promise, {
      loading: t("renamingNote"),
      success: t("noteRenamed"),
      error: t("failedToRenameNote"),
    });

    await promise;
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-60"
          align="end"
          alignOffset={8}
          forceMount
        >
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              setIsRenameModalOpen(true);
            }}
          >
            <Pencil className="w-4 h-4 mr-2" />
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            <Trash className="w-4 h-4 mr-2" />
            {t("delete")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="text-xs text-muted-foreground p-2">
            {t("lastEditedBy", { name: user?.fullName ?? "" })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
      {document && (
        <RenameModal
          isOpen={isRenameModalOpen}
          onClose={() => setIsRenameModalOpen(false)}
          currentTitle={document.title}
          onRename={handleRename}
        />
      )}
    </>
  );
}

Menu.Skeleton = function MenuSkeleton() {
  return <Skeleton className="w-10 h-10" />;
};
