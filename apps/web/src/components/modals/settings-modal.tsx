"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/components/ui/dialog";
import { useSettings } from "@/src/hooks/use-settings";
import { Label } from "@/src/components/ui/label";
import { ModeToggle } from "@/src/components/mode-toggle";
import { LanguageToggle } from "@/src/components/language-toggle";
import { useTranslations } from "next-intl";

export function SettingsModal() {
  const settings = useSettings();
  const t = useTranslations("Modals.settings");

  return (
    <Dialog open={settings.isOpen} onOpenChange={settings.onClose}>
      <DialogContent>
        <DialogHeader className="border-b pb-3">
          <DialogTitle>{t('mySettings')}</DialogTitle>
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
