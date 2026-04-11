"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useParams } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useConverImage } from "@/src/hooks/use-cover-image";
import { SingleImageDropzone } from "@/src/components/single-image-dropzone";
import { useTranslations } from "next-intl";
import { useEdgeStore } from "@/src/lib/edgestore";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export function CoverImageModal() {
  const params = useParams();
  const update = useMutation(api.documents.update);
  const [file, setFile] = useState<File>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const coverImage = useConverImage();
  const { edgestore } = useEdgeStore();
  const t = useTranslations("Modals.coverImage");

  const onClose = () => {
    setFile(undefined);
    setIsSubmitting(false);
    coverImage.onClose();
  };

  const onChange = async (file?: File) => {
    if (file) {
      setIsSubmitting(true);
      setFile(file);

      const response = await edgestore.publicFiles.upload({
        file,
        options: {
          replaceTargetUrl: coverImage.url,
        },
      });

      await update({
        id: params.documentId as Id<"documents">,
        coverImage: response.url,
      });

      onClose();
    }
  };

  return (
    <Dialog open={coverImage.isOpen} onOpenChange={coverImage.onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-center">{t('coverImage')}</DialogTitle>
        </DialogHeader>
        <SingleImageDropzone
          className="w-full outline-none"
          disabled={isSubmitting}
          value={file}
          onChange={onChange}
        />
      </DialogContent>
    </Dialog>
  );
}
