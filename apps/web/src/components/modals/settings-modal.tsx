"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useSettings } from "@notion/business/hooks";
import { Label } from "@/src/components/ui/label";
import { ModeToggle } from "@/src/components/mode-toggle";
import { LanguageToggle } from "@/src/components/language-toggle";
import { useTranslations } from "next-intl";

export function SettingsModal() {
  const settings = useSettings();
  const t = useTranslations("Modals.settings");

  const handleOpenChange = (open: boolean) => {
    if (open) return;

    settings.onClose();
  };

  return (
    <Dialog open={settings.isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="border-b pb-3">
          <DialogTitle>{t('mySettings')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("mySettings")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-y-1">
            <Label>{t('appearance')}</Label>
            <span className="text-[0.8rem] text-muted-foreground">
              {t('customizeHowNotionLooks')}
            </span>
          </div>
          <ModeToggle />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-y-1">
            <Label>{t('language')}</Label>
            <span className="text-[0.8rem] text-muted-foreground">
              {t('changeTheLanguageOfNotion')}
            </span>
          </div>
          <LanguageToggle />
        </div>
      </DialogContent>
    </Dialog>
  );
}
