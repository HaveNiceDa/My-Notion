"use client";

import { AlertTriangle, CheckCircle2, Clock, DatabaseZap, EyeOff, Inbox, WandSparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AgentMemoryItem } from "./types";
import { buildMemoryMetrics } from "./utils";

interface MemoryOverviewProps {
  activeMemories: AgentMemoryItem[];
  pendingMemories: AgentMemoryItem[];
}

export function MemoryOverview({ activeMemories, pendingMemories }: MemoryOverviewProps) {
  const t = useTranslations("MemoryReview");
  const metrics = buildMemoryMetrics(activeMemories, pendingMemories);
  const cards = [
    { key: "active", label: t("overviewActive"), value: metrics.activeCount, icon: CheckCircle2 },
    { key: "pending", label: t("overviewPending"), value: metrics.pendingCount, icon: Inbox },
    { key: "syncFailed", label: t("overviewSyncFailed"), value: metrics.syncFailedCount, icon: AlertTriangle },
    { key: "reviewDue", label: t("overviewReviewDue"), value: metrics.reviewDueCount, icon: Clock },
    { key: "sensitive", label: t("overviewSensitive"), value: metrics.sensitiveCount, icon: EyeOff },
    { key: "recentlyUsed", label: t("overviewRecentlyUsed"), value: metrics.recentlyUsedCount, icon: DatabaseZap },
    { key: "autoExtracted", label: t("overviewAutoExtracted"), value: metrics.autoExtractedPendingCount, icon: WandSparkles },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className="rounded-xl border bg-background/80 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="text-2xl font-semibold">{card.value}</div>
          </div>
        );
      })}
    </section>
  );
}
