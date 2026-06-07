import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { enqueueEvent } from "./stream";
import type { AgentCheckpointKind, AgentStreamEvent, AgentStreamEventSink } from "./stream";

interface AgentRunRecorderOptions {
  convex: ConvexHttpClient | null;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  runId: string;
  assistantMessageId: string;
  initialSeq?: number;
}

interface CheckpointPayload {
  kind: AgentCheckpointKind;
  resumeState?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// 流式续跑的运行期记录器：统一分配 seq、写 NDJSON、异步持久化 event/checkpoint。
export class AgentRunRecorder {
  private seq = 0;
  private pendingWrites: Array<Promise<unknown>> = [];
  private text = "";
  private reasoning = "";

  constructor(private readonly options: AgentRunRecorderOptions) {
    this.seq = options.initialSeq ?? 0;
  }

  get lastSeq() {
    return this.seq;
  }

  getDraft() {
    return {
      text: this.text,
      reasoning: this.reasoning,
    };
  }

  emit: AgentStreamEventSink = (event) => {
    const nextSeq = this.nextSeq();
    const eventWithCursor = {
      ...event,
      runId: this.options.runId,
      seq: nextSeq,
    } as AgentStreamEvent & { runId: string; seq: number };
    if (event.type === "text-delta") this.text += event.delta;
    if (event.type === "reasoning-delta") this.reasoning += event.delta;
    enqueueEvent(this.options.controller, this.options.encoder, eventWithCursor);
    this.persistEvent(nextSeq, eventWithCursor);
  };

  emitRunStart() {
    this.emit({
      type: "run-start",
      runId: this.options.runId,
      seq: this.seq + 1,
      assistantMessageId: this.options.assistantMessageId,
    });
  }

  checkpoint(payload: CheckpointPayload) {
    const nextSeq = this.seq + 1;
    this.emit({
      type: "checkpoint",
      runId: this.options.runId,
      seq: nextSeq,
      checkpointKind: payload.kind,
    });
    this.persistCheckpoint(nextSeq, payload);
  }

  async flush() {
    const writes = this.pendingWrites.splice(0);
    if (writes.length === 0) return;
    await Promise.allSettled(writes);
  }

  private nextSeq() {
    this.seq += 1;
    return this.seq;
  }

  private persistEvent(seq: number, event: AgentStreamEvent & { runId: string; seq: number }) {
    if (!this.options.convex) return;
    this.pendingWrites.push(
      this.options.convex.mutation(api.aiChat.appendAgentRunEvent, {
        runId: this.options.runId,
        seq,
        eventType: event.type,
        eventJson: JSON.stringify(event),
      }).catch((error) => {
        console.warn("[AgentRunRecorder] Failed to persist stream event:", error);
      }),
    );
  }

  private persistCheckpoint(seq: number, payload: CheckpointPayload) {
    if (!this.options.convex) return;
    this.pendingWrites.push(
      this.options.convex.mutation(api.aiChat.appendAgentRunCheckpoint, {
        runId: this.options.runId,
        seq,
        kind: payload.kind,
        checkpointJson: JSON.stringify({
          runId: this.options.runId,
          seq,
          kind: payload.kind,
          assistantMessageId: this.options.assistantMessageId,
          resumeState: payload.resumeState ?? {},
          metadata: payload.metadata ?? {},
          createdAt: Date.now(),
        }),
      }).catch((error) => {
        console.warn("[AgentRunRecorder] Failed to persist checkpoint:", error);
      }),
    );
  }
}
