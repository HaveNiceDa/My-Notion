import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { deleteAgentMemoryIndex, syncAgentMemory } from "@notion/ai/server";
import { invalidateToolResultCache } from "@/src/lib/agent/tool-result-cache";

type MemoryType = "preference" | "project" | "episodic";

interface MemorySyncBody {
  action?: "upsert" | "delete";
  memory?: {
    id?: string;
    type?: MemoryType;
    content?: string;
    reason?: string;
    confidence?: number;
    source?: string;
    updatedAt?: number;
  };
  memoryId?: string;
}

function isQdrantUnavailable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes("QDRANT_URL") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("connect") ||
    msg.includes("timeout")
  );
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as MemorySyncBody;
    const invalidatedCacheCount = invalidateToolResultCache({
      userId,
      toolNames: ["memory_read"],
    });

    try {
      if (body.action === "upsert") {
        const memory = normalizeMemory(body.memory);
        if (!memory) {
          return NextResponse.json({ success: false, error: "Invalid memory payload" }, { status: 400 });
        }
        await syncAgentMemory({ userId, memory });
        return NextResponse.json({ success: true, invalidatedCacheCount });
      }

      if (body.action === "delete") {
        const memoryId = typeof body.memoryId === "string" ? body.memoryId.trim() : "";
        if (!memoryId) {
          return NextResponse.json({ success: false, error: "memoryId is required" }, { status: 400 });
        }
        await deleteAgentMemoryIndex({ userId, memoryId });
        return NextResponse.json({ success: true, invalidatedCacheCount });
      }
    } catch (error) {
      if (isQdrantUnavailable(error)) {
        return NextResponse.json({
          success: true,
          invalidatedCacheCount,
          warning: "Vector store unavailable — memory cache was invalidated but memory was not indexed",
        });
      }
      throw error;
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("[Agent Memory Sync] Error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

function normalizeMemory(memory: MemorySyncBody["memory"]) {
  if (!memory || typeof memory.id !== "string" || typeof memory.content !== "string") {
    return null;
  }

  const type = isMemoryType(memory.type) ? memory.type : undefined;
  if (!type) {
    return null;
  }

  const content = memory.content.trim();
  if (!content) {
    return null;
  }

  return {
    id: memory.id,
    type,
    content,
    reason: typeof memory.reason === "string" && memory.reason.trim()
      ? memory.reason.trim()
      : undefined,
    confidence: typeof memory.confidence === "number" && Number.isFinite(memory.confidence)
      ? Math.min(Math.max(memory.confidence, 0), 1)
      : 1,
    source: typeof memory.source === "string" ? memory.source : undefined,
    updatedAt: typeof memory.updatedAt === "number" && Number.isFinite(memory.updatedAt)
      ? memory.updatedAt
      : Date.now(),
  };
}

function isMemoryType(value: unknown): value is MemoryType {
  return value === "preference" || value === "project" || value === "episodic";
}
