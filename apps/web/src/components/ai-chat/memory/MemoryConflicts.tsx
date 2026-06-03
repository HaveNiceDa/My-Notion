"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import type { AgentMemoryItem } from "./types";
import { formatDate, scopeLabel } from "./utils";

interface MemoryConflictsProps {
  memories: AgentMemoryItem[];
  onOpenDetail: (memory: AgentMemoryItem) => void;
}

export function MemoryConflicts({ memories, onOpenDetail }: MemoryConflictsProps) {
  const t = useTranslations("MemoryReview");
  const [now] = useState(() => Date.now());

  const conflictMemories = memories.filter((memory) =>
    (memory.conflictsWith && memory.conflictsWith.length > 0)
    || (memory.supersedes && memory.supersedes.length > 0)
    || (memory.reviewDueAt && memory.reviewDueAt <= now),
  );

  return (
    <section className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <h2 className="text-sm font-medium">{t("conflictsTitle")}</h2>
      </div>
      {conflictMemories.length === 0 ? (
        <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          {t("conflictsEmpty")}
        </div>
      ) : (
        <div className="space-y-3">
          {conflictMemories.map((memory) => (
            <article key={memory.id} className="rounded-lg border bg-muted/20 p-3">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-600 dark:text-amber-400">
                  {memory.conflictsWith?.length
                    ? t("conflictBadge")
                    : memory.supersedes?.length
                      ? t("supersedesBadge")
                      : t("reviewDueBadge")}
                </span>
                <span>{scopeLabel(memory)}</span>
                <span>{t("updatedAt", { date: formatDate(memory.updatedAt) })}</span>
              </div>
              <p className="line-clamp-2 text-sm text-foreground">{memory.content}</p>
              <div className="mt-3 flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenDetail(memory)}>
                  {t("viewDetail")}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled>
                  {t("archive")}
                </Button>
                <Button type="button" variant="ghost" size="sm" disabled>
                  {t("keepBoth")}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
