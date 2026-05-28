type MemoryType = "preference" | "project" | "episodic";

export interface AgentMemorySyncPayload {
  id: string;
  type: MemoryType;
  content: string;
  reason?: string;
  confidence?: number;
  source?: string;
  updatedAt?: number;
}

export async function syncMemoryIndex(memory: AgentMemorySyncPayload): Promise<void> {
  await postMemorySync({ action: "upsert", memory });
}

export async function deleteMemoryIndex(memoryId: string): Promise<void> {
  await postMemorySync({ action: "delete", memoryId });
}

async function postMemorySync(body: unknown): Promise<void> {
  const response = await fetch("/api/agent/memories/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Memory sync failed with status ${response.status}`);
  }

  const result = await response.json().catch(() => null) as { warning?: string } | null;
  if (result?.warning) {
    console.warn("[Agent Memory Sync]", result.warning);
  }
}
