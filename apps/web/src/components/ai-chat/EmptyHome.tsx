"use client";

import React, { useMemo } from "react";
import { FileText, Languages, Search, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";

interface EmptyHomeProps {
  onPromptSelect: (prompt: string) => void;
}

export const EmptyHome = React.memo(({ onPromptSelect }: EmptyHomeProps) => {
  const t = useTranslations("AI");

  const actions = useMemo(
    () => [
      {
        icon: FileText,
        label: t("summarizeThisPage"),
        prompt: t("summarizeThisPagePrompt"),
      },
      {
        icon: Languages,
        label: t("translateThisPage"),
        prompt: t("translateThisPagePrompt"),
      },
      {
        icon: Search,
        label: t("deepAnalyze"),
        prompt: t("deepAnalyzePrompt"),
      },
      {
        icon: CircleCheck,
        label: t("createTaskTracker"),
        prompt: t("createTaskTrackerPrompt"),
      },
    ],
    [t],
  );

  return (
    <div className="flex-1 overflow-y-auto px-5 py-6">
      <div className="min-h-full flex flex-col justify-end gap-5 pb-2">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("todayIWillHelp")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("aiSidebarHomeSubtitle")}
          </p>
        </div>

        <div className="space-y-1.5">
          {actions.map(({ icon: Icon, label, prompt }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPromptSelect(prompt)}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span>{label}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
});

EmptyHome.displayName = "EmptyHome";
