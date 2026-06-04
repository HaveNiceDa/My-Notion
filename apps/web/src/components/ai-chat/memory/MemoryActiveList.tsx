"use client";

import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
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
  MemoryType,
} from "./types";
import {
  filterActiveMemories,
  formatDate,
  MEMORY_TYPES,
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
        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={filters.query}
              onChange={(event) => onFiltersChange({ ...filters, query: event.target.value })}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.type}
            onValueChange={(value) => onFiltersChange({ ...filters, type: value as "all" | MemoryType })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("typeAll")}</SelectItem>
              {MEMORY_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`type_${type}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
                {t(`type_${memory.type}`)}
              </span>
              <span>{t(`source_${memory.source}`)}</span>
              <span>{t("updatedAt", { date: formatDate(memory.updatedAt) })}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
              {memory.summary || memory.content}
            </p>
          </div>
          {memory.reason && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              {t("reasonLabel")}: {memory.reason}
            </p>
          )}
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
      )}
    </article>
  );
}
