"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Brain, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Textarea } from "@/src/components/ui/textarea";
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

type MemoryType = "preference" | "project" | "episodic";

interface AgentMemoryReviewItem {
  id: Id<"agentMemories">;
  type: MemoryType;
  content: string;
  source: "user_explicit" | "agent_proposed" | "manual";
  reason?: string;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

interface EditState {
  type: MemoryType;
  content: string;
  reason: string;
  confidence: string;
}

const MEMORY_TYPES: MemoryType[] = ["preference", "project", "episodic"];

export function MemoryReviewPage() {
  const t = useTranslations("MemoryReview");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | MemoryType>("all");
  const [isCreating, setIsCreating] = useState(false);
  const [createState, setCreateState] = useState<EditState>({
    type: "preference",
    content: "",
    reason: "",
    confidence: "1",
  });
  const [editingId, setEditingId] = useState<Id<"agentMemories"> | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);

  const queryArgs = useMemo(
    () => ({
      limit: 100,
      ...(query.trim() ? { query: query.trim() } : {}),
      ...(typeFilter !== "all" ? { type: typeFilter } : {}),
    }),
    [query, typeFilter],
  );

  const memories = useQuery(api.agentMemories.listAgentMemories, queryArgs) as
    | AgentMemoryReviewItem[]
    | undefined;
  const createMemory = useMutation(api.agentMemories.createAgentMemory);
  const updateMemory = useMutation(api.agentMemories.updateAgentMemory);
  const deactivateMemory = useMutation(api.agentMemories.deactivateAgentMemory);

  function startEdit(memory: AgentMemoryReviewItem) {
    setEditingId(memory.id);
    setEditState({
      type: memory.type,
      content: memory.content,
      reason: memory.reason ?? "",
      confidence: String(memory.confidence),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  function resetCreateForm() {
    setCreateState({ type: "preference", content: "", reason: "", confidence: "1" });
    setIsCreating(false);
  }

  async function handleCreate() {
    const content = createState.content.trim();
    if (!content) {
      toast.error(t("contentRequired"));
      return;
    }

    const confidence = Number(createState.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      toast.error(t("confidenceInvalid"));
      return;
    }

    const promise = createMemory({
      type: createState.type,
      content,
      source: "manual",
      confidence,
      ...(createState.reason.trim() ? { reason: createState.reason.trim() } : {}),
    });

    toast.promise(promise, {
      loading: t("creating"),
      success: t("created"),
      error: t("createFailed"),
    });

    await promise;
    resetCreateForm();
  }

  async function handleSave(memoryId: Id<"agentMemories">) {
    if (!editState) return;

    const content = editState.content.trim();
    if (!content) {
      toast.error(t("contentRequired"));
      return;
    }

    const confidence = Number(editState.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
      toast.error(t("confidenceInvalid"));
      return;
    }

    const promise = updateMemory({
      memoryId,
      type: editState.type,
      content,
      confidence,
      ...(editState.reason.trim() ? { reason: editState.reason.trim() } : {}),
    });

    toast.promise(promise, {
      loading: t("saving"),
      success: t("saved"),
      error: t("saveFailed"),
    });

    await promise;
    cancelEdit();
  }

  async function handleDelete(memoryId: Id<"agentMemories">) {
    const promise = deactivateMemory({ memoryId });
    toast.promise(promise, {
      loading: t("deleting"),
      success: t("deleted"),
      error: t("deleteFailed"),
    });
    await promise;
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-14">
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
        <div>
          <Button type="button" size="sm" onClick={() => setIsCreating((value) => !value)}>
            <Plus className="h-4 w-4" />
            {t("newMemory")}
          </Button>
        </div>
      </header>

      {isCreating && (
        <section className="mb-5 rounded-xl border bg-background/80 p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-medium">{t("newMemory")}</h2>
          <MemoryForm
            state={createState}
            onStateChange={setCreateState}
            onCancel={resetCreateForm}
            onSave={handleCreate}
            saveLabel={t("create")}
          />
        </section>
      )}

      <section className="mb-5 grid gap-3 rounded-xl border bg-background/80 p-4 shadow-sm md:grid-cols-[1fr_220px]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("searchPlaceholder")}
        />
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as "all" | MemoryType)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">{t("typeAll")}</option>
          {MEMORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type_${type}`)}
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-1 flex-col gap-3">
        {memories === undefined ? (
          <div className="rounded-xl border bg-background/80 p-6 text-sm text-muted-foreground">
            {t("loading")}
          </div>
        ) : memories.length === 0 ? (
          <div className="rounded-xl border bg-background/80 p-8 text-center text-sm text-muted-foreground">
            {t("empty")}
          </div>
        ) : (
          memories.map((memory) => (
            <MemoryReviewCard
              key={memory.id}
              memory={memory}
              isEditing={editingId === memory.id}
              editState={editingId === memory.id ? editState : null}
              onEditStateChange={setEditState}
              onStartEdit={() => startEdit(memory)}
              onCancelEdit={cancelEdit}
              onSave={() => handleSave(memory.id)}
              onDelete={() => handleDelete(memory.id)}
            />
          ))
        )}
      </section>
    </div>
  );
}

interface MemoryFormProps {
  state: EditState;
  onStateChange: (state: EditState) => void;
  onCancel: () => void;
  onSave: () => void;
  saveLabel: string;
}

function MemoryForm({
  state,
  onStateChange,
  onCancel,
  onSave,
  saveLabel,
}: MemoryFormProps) {
  const t = useTranslations("MemoryReview");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[220px_160px]">
        <select
          value={state.type}
          onChange={(event) =>
            onStateChange({ ...state, type: event.target.value as MemoryType })
          }
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {MEMORY_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`type_${type}`)}
            </option>
          ))}
        </select>
        <Input
          type="number"
          min="0"
          max="1"
          step="0.1"
          value={state.confidence}
          onChange={(event) =>
            onStateChange({ ...state, confidence: event.target.value })
          }
          aria-label={t("confidence")}
        />
      </div>
      <Textarea
        value={state.content}
        onChange={(event) => onStateChange({ ...state, content: event.target.value })}
        placeholder={t("contentPlaceholder")}
        className="min-h-24"
      />
      <Input
        value={state.reason}
        onChange={(event) => onStateChange({ ...state, reason: event.target.value })}
        placeholder={t("reasonPlaceholder")}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
          {t("cancel")}
        </Button>
        <Button type="button" size="sm" onClick={onSave}>
          <Save className="h-4 w-4" />
          {saveLabel}
        </Button>
      </div>
    </div>
  );
}

interface MemoryReviewCardProps {
  memory: AgentMemoryReviewItem;
  isEditing: boolean;
  editState: EditState | null;
  onEditStateChange: (state: EditState) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}

function MemoryReviewCard({
  memory,
  isEditing,
  editState,
  onEditStateChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
}: MemoryReviewCardProps) {
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">
              {t(`type_${memory.type}`)}
            </span>
            <span>{t(`source_${memory.source}`)}</span>
            <span>{t("confidenceValue", { value: memory.confidence.toFixed(1) })}</span>
            <span>{t("updatedAt", { date: formatDate(memory.updatedAt) })}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{memory.content}</p>
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

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
