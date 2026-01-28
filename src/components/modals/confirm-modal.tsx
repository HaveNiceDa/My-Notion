"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import React from "react";
import { useTranslations } from "next-intl";

interface ConfirmModalProps {
  children: React.ReactNode;
  onConfirm: () => void;
}

export function ConfirmModal({ children, onConfirm }: ConfirmModalProps) {
  const t = useTranslations("Modals.confirm");
  
  const handleConfirm = (
    e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
  ) => {
    e.stopPropagation();
    onConfirm();
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger onClick={(e) => e.stopPropagation()} asChild>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('areYouAbsolutelySure')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('thisActionCannotBeUndone')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3">{children}</div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={(e) => e.stopPropagation()}>
              {t('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>{t('confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
