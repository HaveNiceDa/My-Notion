import type OpenAI from "openai";

export interface AccumulatedToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolCallChange {
  index: number;
  call: AccumulatedToolCall;
  isNew: boolean;
  idUpdated: boolean;
  nameUpdated: boolean;
  /** New argument bytes in this chunk. */
  argsDelta?: string;
  /**
   * Arguments accumulated before the real tool_call id was available.
   * Set only when idUpdated transitions a placeholder id to a real id;
   * callers should send this as an initial args delta after emitting the start event.
   */
  argsBeforeId?: string;
}

/**
 * Accumulates streaming tool_call deltas from OpenAI-compatible API responses.
 *
 * Shared between the Agent stream (NDJSON protocol) and Editor AI stream
 * (AI SDK UIMessage protocol). Callers handle event emission; this class
 * only manages the per-index state of partially received tool calls.
 */
export class ToolCallAccumulator {
  private calls = new Map<number, AccumulatedToolCall>();

  /**
   * Feed a delta chunk and return the list of changes. Callers inspect
   * isNew / idUpdated / nameUpdated / argsDelta to emit protocol events.
   */
  feed(delta: {
    tool_calls?: Array<{
      index?: number;
      id?: string;
      function?: { name?: string; arguments?: string };
    }>;
  }): ToolCallChange[] {
    const changes: ToolCallChange[] = [];
    if (!delta.tool_calls) return changes;

    for (const tc of delta.tool_calls) {
      const idx = tc.index ?? 0;
      let existing = this.calls.get(idx);
      let isNew = false;
      let idUpdated = false;
      let nameUpdated = false;
      let argsDelta: string | undefined;
      let argsBeforeId: string | undefined;

      if (!existing) {
        const hasRealId = Boolean(tc.id);
        existing = {
          id: tc.id ?? `tool-${idx}`,
          name: tc.function?.name ?? "",
          arguments: tc.function?.arguments ?? "",
        };
        this.calls.set(idx, existing);
        isNew = true;
        if (tc.function?.name) nameUpdated = true;
        if (tc.function?.arguments) argsDelta = tc.function.arguments;
        if (hasRealId) idUpdated = true;
      } else {
        const wasPlaceholder = existing.id.startsWith("tool-");
        const argsBeforeChunk = existing.arguments;

        if (tc.id && wasPlaceholder) {
          existing.id = tc.id;
          idUpdated = true;
          // Any arguments accumulated while the id was a placeholder
          // need to be flushed to the caller after the start event.
          argsBeforeId = argsBeforeChunk;
        }
        if (tc.function?.name && !existing.name) {
          existing.name = tc.function.name;
          nameUpdated = true;
        }
        if (tc.function?.arguments) {
          existing.arguments += tc.function.arguments;
          argsDelta = tc.function.arguments;
        }
      }

      changes.push({ index: idx, call: existing, isNew, idUpdated, nameUpdated, argsDelta, argsBeforeId });
    }

    return changes;
  }

  /** Get all accumulated tool calls as OpenAI-compatible objects. */
  getToolCalls(): OpenAI.ChatCompletionMessageFunctionToolCall[] {
    return Array.from(this.calls.values()).map((c) => ({
      id: c.id,
      type: "function" as const,
      function: { name: c.name, arguments: c.arguments },
    }));
  }

  /** Get a single accumulated call by index. */
  get(index: number): AccumulatedToolCall | undefined {
    return this.calls.get(index);
  }

  /** Number of unique tool calls accumulated. */
  get size(): number {
    return this.calls.size;
  }

  /** Clear all state. */
  clear(): void {
    this.calls.clear();
  }
}

/**
 * djb2-like string hash → unsigned 32-bit integer string.
 * Used for content-addressable caching (tool results, content hashes).
 */
export function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return String(hash >>> 0);
}
