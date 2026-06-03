"use client";

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";

const SETTINGS = [
  "settingAutoMode",
  "settingSensitivePolicy",
  "settingDefaultScope",
  "settingEpisodicTtl",
  "settingInlinePrompt",
] as const;

export function MemorySettings() {
  const t = useTranslations("MemoryReview");

  return (
    <section className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Settings className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-medium">{t("settingsTitle")}</h2>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("settingsDescription")}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {SETTINGS.map((key) => (
          <div key={key} className="rounded-lg border bg-muted/20 p-3">
            <div className="text-sm font-medium">{t(`${key}Title`)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t(`${key}Description`)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
