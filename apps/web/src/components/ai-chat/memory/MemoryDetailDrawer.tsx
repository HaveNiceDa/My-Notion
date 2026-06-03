"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";
import type { AgentMemoryItem } from "./types";
import { formatDate, scopeLabel } from "./utils";

interface MemoryDetailDrawerProps {
  memory: AgentMemoryItem | null;
  onClose: () => void;
}

export function MemoryDetailDrawer({ memory, onClose }: MemoryDetailDrawerProps) {
  const t = useTranslations("MemoryReview");

  if (!memory) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/50 backdrop-blur-sm">
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l bg-background p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("detailTitle")}</h2>
            <p className="text-xs text-muted-foreground">{memory.id}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            {t("closeDetail")}
          </Button>
        </div>

        <div className="space-y-4">
          <DetailSection title={t("detailContent")}>
            <p className="whitespace-pre-wrap text-sm leading-6">{memory.content}</p>
          </DetailSection>

          {memory.summary && (
            <DetailSection title={t("detailSummary")}>
              <p className="text-sm">{memory.summary}</p>
            </DetailSection>
          )}

          <DetailSection title={t("detailGovernance")}>
            <DetailGrid
              items={[
                [t("detailKind"), String(memory.kind ?? "-")],
                [t("detailCategory"), memory.category ?? "-"],
                [t("detailScope"), scopeLabel(memory)],
                [t("detailSource"), t(`source_${memory.source}`)],
                [t("detailPrivacy"), t(`privacy_${memory.privacy ?? "normal"}`)],
                [t("detailConfidence"), memory.confidence.toFixed(2)],
                [t("detailImportance"), String(memory.importance ?? 0.5)],
                [t("detailReviewDue"), formatDate(memory.reviewDueAt)],
              ]}
            />
          </DetailSection>

          <DetailSection title={t("detailSync")}>
            <DetailGrid
              items={[
                [t("detailEmbeddingStatus"), t(`embedding_${memory.embeddingStatus ?? "pending"}`)],
                [t("detailEmbeddingUpdatedAt"), formatDate(memory.embeddingUpdatedAt)],
                [t("detailUsageCount"), String(memory.usageCount ?? 0)],
                [t("detailLastUsedAt"), formatDate(memory.lastUsedAt)],
              ]}
            />
            {memory.embeddingError && (
              <p className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {memory.embeddingError}
              </p>
            )}
          </DetailSection>

          <DetailSection title={t("detailEvidence")}>
            <DetailGrid
              items={[
                [t("detailConversation"), memory.evidenceConversationId ?? "-"],
                [t("detailMessage"), memory.evidenceMessageId ?? "-"],
                [t("detailDocument"), memory.evidenceDocumentId ?? "-"],
                [t("detailToolCall"), memory.evidenceToolCallId ?? "-"],
              ]}
            />
            {memory.evidenceText && (
              <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                {memory.evidenceText}
              </p>
            )}
          </DetailSection>

          <DetailSection title={t("detailRelations")}>
            <DetailGrid
              items={[
                [t("detailConflictsWith"), String(memory.conflictsWith?.length ?? 0)],
                [t("detailSupersedes"), String(memory.supersedes?.length ?? 0)],
              ]}
            />
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-background/80 p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function DetailGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="grid gap-2 text-xs md:grid-cols-2">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md bg-muted/50 px-3 py-2">
          <div className="text-muted-foreground">{label}</div>
          <div className="mt-1 break-all text-foreground">{value}</div>
        </div>
      ))}
    </div>
  );
}
