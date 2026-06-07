"use client";

import React, { useMemo } from "react";
import { Brain, FilePlus2, FileText, Library, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCurrentDocumentStore } from "@/src/lib/store/use-current-document-store";

interface EmptyHomeProps {
  onPromptSelect: (prompt: string) => void;
}

export const EmptyHome = React.memo(({ onPromptSelect }: EmptyHomeProps) => {
  const t = useTranslations("AI");
  const currentDocument = useCurrentDocumentStore((state) => state.currentDocument);

  const actions = useMemo(
    () => {
      const supportedActions = [
        currentDocument?.id
          ? {
              icon: FileText,
              label: t("summarizeCurrentDocument"),
              prompt: t("summarizeCurrentDocumentPrompt"),
            }
          : null,
        {
          icon: Search,
          label: t("searchMyDocuments"),
          prompt: t("searchMyDocumentsPrompt"),
        },
        {
          icon: Library,
          label: t("summarizeMyDocuments"),
          prompt: t("summarizeMyDocumentsPrompt"),
        },
        {
          icon: FilePlus2,
          label: t("draftNewDocument"),
          prompt: t("draftNewDocumentPrompt"),
        },
        {
          icon: Brain,
          label: t("rememberPreference"),
          prompt: t("rememberPreferencePrompt"),
        },
      ];
      return supportedActions.filter((action): action is NonNullable<typeof action> => Boolean(action));
    },
    [currentDocument?.id, t],
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
