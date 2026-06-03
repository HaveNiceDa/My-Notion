"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Brain } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { deleteMemoryIndex, syncMemoryIndex } from "@/src/lib/agent/memory-sync-client";
import { MemoryActiveList } from "./MemoryActiveList";
import { MemoryConflicts } from "./MemoryConflicts";
import { MemoryDetailDrawer } from "./MemoryDetailDrawer";
import { MemoryInbox } from "./MemoryInbox";
import { MemoryOverview } from "./MemoryOverview";
import { MemorySettings } from "./MemorySettings";
import type { ActiveMemoryFilters, AgentMemoryItem, MemoryEditState } from "./types";
import { createEditState, validateEditState } from "./utils";

const DEFAULT_FILTERS: ActiveMemoryFilters = {
  query: "",
  type: "all",
  kind: "all",
  embeddingStatus: "all",
  privacy: "all",
  sort: "updated_desc",
};

export function MemoryCenterPage() {
  const t = useTranslations("MemoryReview");
  const [filters, setFilters] = useState<ActiveMemoryFilters>(DEFAULT_FILTERS);
  const [isCreating, setIsCreating] = useState(false);
  const [createState, setCreateState] = useState<MemoryEditState>(createEditState());
  const [editingId, setEditingId] = useState<Id<"agentMemories"> | null>(null);
  const [editState, setEditState] = useState<MemoryEditState | null>(null);
  const [selectedMemory, setSelectedMemory] = useState<AgentMemoryItem | null>(null);

  const activeMemories = useQuery(api.agentMemories.listAgentMemories, { limit: 100 }) as
    | AgentMemoryItem[]
    | undefined;
  const pendingMemories = useQuery(api.agentMemories.listPendingAgentMemories, { limit: 50 }) as
    | AgentMemoryItem[]
    | undefined;

  const createMemory = useMutation(api.agentMemories.createAgentMemory);
  const commitMemory = useMutation(api.agentMemories.commitAgentMemory);
  const rejectMemory = useMutation(api.agentMemories.rejectAgentMemory);
  const updateMemory = useMutation(api.agentMemories.updateAgentMemory);
  const deactivateMemory = useMutation(api.agentMemories.deactivateAgentMemory);

  function resetCreateForm() {
    setCreateState(createEditState());
    setIsCreating(false);
  }

  function startEdit(memory: AgentMemoryItem) {
    setEditingId(memory.id);
    setEditState(createEditState(memory));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function handleCreate() {
    try {
      const { content, confidence } = validateEditState(createState);
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

      const memory = await promise;
      await syncMemory(memory).catch((error) => console.warn("[Agent Memory Sync] create failed:", error));
      resetCreateForm();
    } catch (error) {
      showValidationError(t, error);
    }
  }

  async function handleSave(memory: AgentMemoryItem) {
    if (!editState) return;
    try {
      const { content, confidence } = validateEditState(editState);
      const promise = updateMemory({
        memoryId: memory.id,
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

      const savedMemory = await promise;
      await syncMemory(savedMemory).catch((error) => console.warn("[Agent Memory Sync] update failed:", error));
      cancelEdit();
    } catch (error) {
      showValidationError(t, error);
    }
  }

  async function handleDelete(memory: AgentMemoryItem) {
    const promise = deactivateMemory({ memoryId: memory.id });
    toast.promise(promise, {
      loading: t("deleting"),
      success: t("deleted"),
      error: t("deleteFailed"),
    });
    const deletedMemory = await promise;
    await deleteMemoryIndex(deletedMemory.id)
      .catch((error) => console.warn("[Agent Memory Sync] delete failed:", error));
  }

  async function handleAcceptProposal(memory: AgentMemoryItem, edit?: MemoryEditState) {
    try {
      const nextState = edit ?? createEditState(memory);
      const { content, confidence } = validateEditState(nextState);
      const promise = commitMemory({
        memoryId: memory.id,
        type: nextState.type,
        content,
        confidence,
        ...(nextState.reason.trim() ? { reason: nextState.reason.trim() } : {}),
      });
      toast.promise(promise, {
        loading: t("acceptingProposal"),
        success: t("proposalAccepted"),
        error: t("proposalAcceptFailed"),
      });

      const savedMemory = await promise;
      await syncMemory(savedMemory)
        .catch((error) => console.warn("[Agent Memory Sync] accept proposal failed:", error));
    } catch (error) {
      showValidationError(t, error);
    }
  }

  async function handleRejectProposal(memory: AgentMemoryItem) {
    const promise = rejectMemory({ memoryId: memory.id });
    toast.promise(promise, {
      loading: t("rejectingProposal"),
      success: t("proposalRejected"),
      error: t("proposalRejectFailed"),
    });
    await promise;
  }

  const active = activeMemories ?? [];
  const pending = pendingMemories ?? [];

  return (
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-5 px-6 py-14">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
        </div>
      </header>

      <MemoryOverview activeMemories={active} pendingMemories={pending} />
      <MemoryInbox
        pendingMemories={pendingMemories}
        onAccept={handleAcceptProposal}
        onReject={handleRejectProposal}
        onOpenDetail={setSelectedMemory}
      />
      <MemoryActiveList
        memories={activeMemories}
        filters={filters}
        onFiltersChange={setFilters}
        isCreating={isCreating}
        createState={createState}
        onCreateStateChange={setCreateState}
        onToggleCreate={() => setIsCreating((value) => !value)}
        onCreate={handleCreate}
        onCancelCreate={resetCreateForm}
        editingId={editingId}
        editState={editState}
        onEditStateChange={setEditState}
        onStartEdit={startEdit}
        onCancelEdit={cancelEdit}
        onSave={handleSave}
        onDelete={handleDelete}
        onOpenDetail={setSelectedMemory}
      />
      <MemoryConflicts memories={active} onOpenDetail={setSelectedMemory} />
      <MemorySettings />
      <MemoryDetailDrawer memory={selectedMemory} onClose={() => setSelectedMemory(null)} />
    </div>
  );
}

async function syncMemory(memory: {
  id: Id<"agentMemories">;
  type: "preference" | "project" | "episodic";
  content: string;
  reason?: string;
  confidence: number;
  source: "user_explicit" | "agent_proposed" | "manual" | "auto_extracted" | "system";
  updatedAt: number;
}) {
  await syncMemoryIndex({
    id: memory.id,
    type: memory.type,
    content: memory.content,
    reason: memory.reason,
    confidence: memory.confidence,
    source: memory.source,
    updatedAt: memory.updatedAt,
  });
}

function showValidationError(
  t: ReturnType<typeof useTranslations>,
  error: unknown,
) {
  if (error instanceof Error && error.message === "contentRequired") {
    toast.error(t("contentRequired"));
    return;
  }
  if (error instanceof Error && error.message === "confidenceInvalid") {
    toast.error(t("confidenceInvalid"));
    return;
  }
  throw error;
}
