"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import type {
  ActiveMemoryFilters,
  AgentMemoryItem,
  MemoryEditState,
  MemoryEmbeddingStatus,
  MemoryKind,
  MemoryPrivacy,
  MemoryType,
} from "./types";
import {
  EMBEDDING_STATUSES,
  filterActiveMemories,
  formatDate,
  MEMORY_KINDS,
  MEMORY_TYPES,
  PRIVACY_LEVELS,
  scopeLabel,
} from "./utils";
import { MemoryForm } from "./MemoryForm";

interface MemoryActiveListProps {
  memories: AgentMemoryItem[] | undefined;
  filters: ActiveMemoryFilters;
  onFiltersChange: (filters: ActiveMemoryFilters) => void;
  isCreating: boolean;
  createState: MemoryEditState;
  onCreateStateChange: (state: MemoryEditState) => void;
  onToggleCreate: () => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  editingId: string | null;
  editState: MemoryEditState | null;
  onEditStateChange: (state: MemoryEditState) => void;
  onStartEdit: (memory: AgentMemoryItem) => void;
  onCancelEdit: () => void;
  onSave: (memory: AgentMemoryItem) => void;
  onDelete: (memory: AgentMemoryItem) => void;
  onOpenDetail: (memory: AgentMemoryItem) => void;
}

export function MemoryActiveList({
  memories,
  filters,
  onFiltersChange,
  isCreating,
  createState,
  onCreateStateChange,
  onToggleCreate,
  onCreate,
  onCancelCreate,
  editingId,
  editState,
  onEditStateChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onOpenDetail,
}: MemoryActiveListProps) {
  const t = useTranslations("MemoryReview");
  const visibleMemories = memories ? filterActiveMemories(memories, filters) : undefined;

  return (
    <section className="space-y-4">
      <div className="rounded-xl border bg-background/80 p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">{t("activeTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("activeDescription")}</p>
          </div>
          <Button type="button" size="sm" onClick={onToggleCreate}>
            <Plus className="h-4 w-4" />
            {t("newMemory")}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_140px_150px_150px_150px_150px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <select
            value={filters.type}
            onChange={(event) =>
              onFiltersChange({ ...filters, type: event.target.value as "all" | MemoryType })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("typeAll")}</option>
            {MEMORY_TYPES.map((type) => (
              <option key={type} value={type}>{t(`type_${type}`)}</option>
            ))}
          </select>
          <select
            value={filters.kind}
            onChange={(event) =>
              onFiltersChange({ ...filters, kind: event.target.value as "all" | MemoryKind })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("kindAll")}</option>
            {MEMORY_KINDS.map((kind) => (
              <option key={kind} value={kind}>{kind}</option>
            ))}
          </select>
          <select
            value={filters.embeddingStatus}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                embeddingStatus: event.target.value as "all" | MemoryEmbeddingStatus,
              })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("embeddingAll")}</option>
            {EMBEDDING_STATUSES.map((status) => (
              <option key={status} value={status}>{t(`embedding_${status}`)}</option>
            ))}
          </select>
          <select
            value={filters.privacy}
            onChange={(event) =>
              onFiltersChange({ ...filters, privacy: event.target.value as "all" | MemoryPrivacy })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">{t("privacyAll")}</option>
            {PRIVACY_LEVELS.map((privacy) => (
              <option key={privacy} value={privacy}>{t(`privacy_${privacy}`)}</option>
            ))}
          </select>
          <select
            value={filters.sort}
            onChange={(event) =>
              onFiltersChange({ ...filters, sort: event.target.value as ActiveMemoryFilters["sort"] })
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="updated_desc">{t("sortUpdated")}</option>
            <option value="importance_desc">{t("sortImportance")}</option>
            <option value="usage_desc">{t("sortUsage")}</option>
            <option value="review_due">{t("sortReviewDue")}</option>
          </select>
        </div>
      </div>

      {isCreating && (
        <section className="rounded-xl border bg-background/80 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">{t("newMemory")}</h2>
          <MemoryForm
            state={createState}
            onStateChange={onCreateStateChange}
            onCancel={onCancelCreate}
            onSave={onCreate}
            saveLabel={t("create")}
          />
        </section>
      )}

      <section className="flex flex-1 flex-col gap-3">
        {visibleMemories === undefined ? (
          <div className="rounded-xl border bg-background/80 p-6 text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : visibleMemories.length === 0 ? (
          <div className="rounded-xl border bg-background/80 p-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          visibleMemories.map((memory) => (
            <MemoryActiveCard
              key={memory.id}
              memory={memory}
              isEditing={editingId === memory.id}
              editState={editingId === memory.id ? editState : null}
              onEditStateChange={onEditStateChange}
              onStartEdit={() => onStartEdit(memory)}
              onCancelEdit={onCancelEdit}
              onSave={() => onSave(memory)}
              onDelete={() => onDelete(memory)}
              onOpenDetail={() => onOpenDetail(memory)}
            />
          ))
        )}
      </section>
    </section>
  );
}

interface MemoryActiveCardProps {
  memory: AgentMemoryItem;
  isEditing: boolean;
  editState: MemoryEditState | null;
  onEditStateChange: (state: MemoryEditState) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenDetail: () => void;
}

function MemoryActiveCard({
  memory,
  isEditing,
  editState,
  onEditStateChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onOpenDetail,
}: MemoryActiveCardProps) {
  const t = useTranslations("MemoryReview");

  return (
    <article className="rounded-xl border bg-background/80 p-4 shadow-sm">
      {isEditing && editState ? (
        <MemoryForm
          state={editState}
          onStateChange={onEditStateChange}
          onCancel={onCancelEdit}
          onSave={onSave}
          saveLabel={t("save")}
        />
      ) : (
        <div className="space-y-3">
          <button type="button" className="block w-full text-left" onClick={onOpenDetail}>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                {t(`type_${memory.type}`)}
              </span>
              {memory.kind && <span>{memory.kind}</span>}
              {memory.category && <span>{memory.category}</span>}
              <span>{scopeLabel(memory)}</span>
              <span>{t(`embedding_${memory.embeddingStatus ?? "pending"}`)}</span>
              <span>{t(`privacy_${memory.privacy ?? "normal"}`)}</span>
              <span>{t("updatedAt", { date: formatDate(memory.updatedAt) })}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {memory.summary || memory.content}
            </p>
          </button>
          {memory.reason && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t("reasonLabel")}: {memory.reason}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {t("usageValue", { count: memory.usageCount ?? 0 })} ·{" "}
              {t("importanceValue", { value: (memory.importance ?? 0.5).toFixed(1) })}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={onStartEdit}>
                <Pencil className="h-4 w-4" />
                {t("edit")}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                    {t("delete")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("deleteConfirmDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>
                      {t("confirmDelete")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
