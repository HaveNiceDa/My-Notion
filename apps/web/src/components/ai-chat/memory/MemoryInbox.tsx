"use client";

import { useState } from "react";
import { AlertTriangle, Check, Inbox, Pencil, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";
import type { AgentMemoryItem, MemoryEditState } from "./types";
import { createEditState } from "./utils";
import { MemoryForm } from "./MemoryForm";

interface MemoryInboxProps {
  pendingMemories: AgentMemoryItem[] | undefined;
  onAccept: (memory: AgentMemoryItem, edit?: MemoryEditState) => void;
  onReject: (memory: AgentMemoryItem) => void;
}

export function MemoryInbox({
  pendingMemories,
  onAccept,
  onReject,
}: MemoryInboxProps) {
  const t = useTranslations("MemoryReview");

  return (
    <section className="rounded-xl border bg-background/80 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-medium">{t("inboxTitle")}</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{t("inboxDescription")}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {t("pendingCount", { count: pendingMemories?.length ?? 0 })}
        </span>
      </div>
      {pendingMemories === undefined ? (
        <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{t("loading")}</div>
      ) : pendingMemories.length === 0 ? (
        <div className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">{t("inboxEmpty")}</div>
      ) : (
        <div className="space-y-3">
          {pendingMemories.map((memory) => (
            <MemoryProposalCard
              key={memory.id}
              memory={memory}
              onAccept={(edit) => onAccept(memory, edit)}
              onReject={() => onReject(memory)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface MemoryProposalCardProps {
  memory: AgentMemoryItem;
  onAccept: (edit?: MemoryEditState) => void;
  onReject: () => void;
}

function MemoryProposalCard({ memory, onAccept, onReject }: MemoryProposalCardProps) {
  const t = useTranslations("MemoryReview");
  const [isEditing, setIsEditing] = useState(false);
  const [editState, setEditState] = useState<MemoryEditState>(createEditState(memory));

  return (
    <article className="rounded-lg border border-dashed bg-muted/20 p-3">
      {isEditing ? (
        <MemoryForm
          state={editState}
          onStateChange={setEditState}
          onCancel={() => setIsEditing(false)}
          onSave={() => onAccept(editState)}
          saveLabel={t("acceptEditedProposal")}
        />
      ) : (
        <div className="space-y-3">
          <div>
            <MemoryBadges memory={memory} />
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{memory.content}</p>
          </div>
          {memory.reason && (
            <p className="rounded-md bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              {t("reasonLabel")}: {memory.reason}
            </p>
          )}
          {memory.evidenceText && (
            <p className="line-clamp-2 rounded-md bg-background/70 px-3 py-2 text-xs text-muted-foreground">
              {t("evidenceLabel")}: {memory.evidenceText}
            </p>
          )}
          {memory.conflictsWith && memory.conflictsWith.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("possibleDuplicateHint")}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4" />
              {t("edit")}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onReject}>
              <X className="h-4 w-4" />
              {t("ignoreProposal")}
            </Button>
            <Button type="button" size="sm" onClick={() => onAccept()}>
              <Check className="h-4 w-4" />
              {t("acceptProposal")}
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function MemoryBadges({ memory }: { memory: AgentMemoryItem }) {
  const t = useTranslations("MemoryReview");
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
        {t(`type_${memory.type}`)}
      </span>
      <span>{t(`source_${memory.source}`)}</span>
    </div>
  );
}
