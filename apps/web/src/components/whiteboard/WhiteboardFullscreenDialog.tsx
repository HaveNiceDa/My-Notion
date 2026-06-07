"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslations } from "next-intl";
import { cn } from "@notion/business/utils";

interface WhiteboardFullscreenDialogProps {
  whiteboardId: string;
  initialWhiteboard?: {
    title: string;
    sceneJson: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WhiteboardFullscreenDialog({
  open,
  onOpenChange,
}: WhiteboardFullscreenDialogProps) {
  const t = useTranslations("Whiteboard");

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-[99999] bg-background",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
            "duration-200",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-[99999] h-dvh w-screen overflow-hidden bg-background outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.98]",
            "duration-200",
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            {t("disabledTitle")}
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("disabledDescription")}
          </DialogPrimitive.Description>
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-sm rounded-xl border bg-card p-6 shadow-sm">
              <div className="text-base font-medium text-foreground">{t("disabledTitle")}</div>
              <div className="mt-2 text-sm text-muted-foreground">{t("disabledDescription")}</div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
