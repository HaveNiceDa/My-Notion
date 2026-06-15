export type MobileAgentMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type MobileAgentStreamCursor = {
  runId: string;
  lastAppliedSeq: number;
  assistantMessageId: string;
};

export type MobileCurrentDocument = {
  id: string;
  title?: string;
  content?: string;
} | null;

export type MobileAgentStreamCallbacks = {
  onRunStart?: (cursor: MobileAgentStreamCursor) => void;
  onCheckpoint?: (
    cursor: MobileAgentStreamCursor,
    checkpointKind: string,
  ) => void;
  onTextDelta?: (delta: string) => void;
  onReasoningDelta?: (delta: string) => void;
  onToolEvent?: (event: MobileAgentStreamEvent) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
};

export type StreamAgentParams = {
  messages: MobileAgentMessage[];
  modelId: string;
  conversationId?: string;
  enableThinking?: boolean;
  knowledgeBaseEnabled?: boolean;
  currentDocument?: MobileCurrentDocument;
  authToken?: string | null;
  signal?: AbortSignal;
};

export type ResumeAgentStreamParams = {
  cursor: MobileAgentStreamCursor;
  authToken?: string | null;
  signal?: AbortSignal;
};

export type MobileAgentStreamEvent =
  | {
    type: "run-start";
    runId: string;
    seq: number;
    assistantMessageId: string;
  }
  | {
    type: "checkpoint";
    runId: string;
    seq: number;
    checkpointKind: string;
  }
  | {
    type: "resume-start";
    runId: string;
    fromSeq: number;
    replayedCount: number;
  }
  | {
    type: "resume-unavailable";
    runId: string;
    reason: string;
    recoverable: boolean;
  }
  | {
    type: "text-delta";
    runId?: string;
    seq?: number;
    id: string;
    delta: string;
  }
  | {
    type: "reasoning-delta";
    runId?: string;
    seq?: number;
    id: string;
    delta: string;
  }
  | {
    type: "tool-call-start" | "tool-call-delta" | "tool-result-delta";
    runId?: string;
    seq?: number;
    toolCallId: string;
    toolName?: string;
    delta?: string;
  }
  | {
    type: "tool-call-result";
    runId?: string;
    seq?: number;
    toolCallId: string;
    result: unknown;
  }
  | {
    type: "finish";
    runId?: string;
    seq?: number;
    model: string;
    usage: null;
  }
  | {
    type: "error";
    runId?: string;
    seq?: number;
    message: string;
  };

const AI_SERVICE_URL = process.env.EXPO_PUBLIC_AI_SERVICE_URL;

function getAIServiceUrl(): string {
  if (!AI_SERVICE_URL) {
    throw new Error("EXPO_PUBLIC_AI_SERVICE_URL is not configured");
  }
  return AI_SERVICE_URL;
}

function buildJsonHeaders(authToken?: string | null): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseAgentStreamEvent(line: string): MobileAgentStreamEvent | null {
  try {
    const parsed: unknown = JSON.parse(line);
    if (!isRecord(parsed) || typeof parsed.type !== "string") return null;
    return parsed as MobileAgentStreamEvent;
  } catch {
    return null;
  }
}

function getEventSeq(event: MobileAgentStreamEvent): number | null {
  if ("seq" in event && typeof event.seq === "number") {
    return event.seq;
  }
  return null;
}

function getEventRunId(event: MobileAgentStreamEvent): string | null {
  if ("runId" in event && typeof event.runId === "string") {
    return event.runId;
  }
  return null;
}

function updateCursorFromEvent(
  cursor: MobileAgentStreamCursor | null,
  event: MobileAgentStreamEvent,
): MobileAgentStreamCursor | null {
  if (event.type === "run-start") {
    return {
      runId: event.runId,
      lastAppliedSeq: event.seq,
      assistantMessageId: event.assistantMessageId,
    };
  }

  const seq = getEventSeq(event);
  if (!cursor || seq === null) return cursor;

  return {
    ...cursor,
    lastAppliedSeq: Math.max(cursor.lastAppliedSeq, seq),
  };
}

function dispatchAgentEvent(
  event: MobileAgentStreamEvent,
  callbacks: MobileAgentStreamCallbacks,
  state: { cursor: MobileAgentStreamCursor | null },
) {
  const seq = getEventSeq(event);
  if (seq !== null && state.cursor && seq <= state.cursor.lastAppliedSeq) {
    return;
  }

  state.cursor = updateCursorFromEvent(state.cursor, event);

  switch (event.type) {
    case "run-start":
      callbacks.onRunStart?.(state.cursor!);
      break;
    case "checkpoint":
      if (state.cursor) {
        callbacks.onCheckpoint?.(state.cursor, event.checkpointKind);
      }
      break;
    case "text-delta":
      callbacks.onTextDelta?.(event.delta);
      break;
    case "reasoning-delta":
      callbacks.onReasoningDelta?.(event.delta);
      break;
    case "finish":
      callbacks.onComplete?.();
      break;
    case "error":
      callbacks.onError?.(new Error(event.message));
      break;
    case "resume-unavailable":
      callbacks.onError?.(new Error(event.reason));
      break;
    default:
      callbacks.onToolEvent?.(event);
      break;
  }
}

function processNDJSONBuffer(
  buffer: string,
  callbacks: MobileAgentStreamCallbacks,
  state: { cursor: MobileAgentStreamCursor | null },
): string {
  const lines = buffer.split("\n");

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const event = parseAgentStreamEvent(line);
    if (!event) continue;
    dispatchAgentEvent(event, callbacks, state);
  }

  return lines[lines.length - 1];
}

async function parseNDJSONStream(
  response: Response,
  callbacks: MobileAgentStreamCallbacks,
  initialCursor: MobileAgentStreamCursor | null,
): Promise<void> {
  const state = { cursor: initialCursor };
  const reader = response.body?.getReader?.();

  if (!reader) {
    const text = await response.text();
    processNDJSONBuffer(`${text}\n`, callbacks, state);
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      buffer = processNDJSONBuffer(buffer, callbacks, state);
    }
    if (buffer.trim()) {
      processNDJSONBuffer(`${buffer}\n`, callbacks, state);
    }
  } finally {
    reader.releaseLock();
  }
}

async function parseErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (isRecord(body) && typeof body.error === "string") {
      return body.error;
    }
  } catch {
    // Fall back to HTTP status text below.
  }
  return `${response.status} ${response.statusText}`;
}

async function postAgentStream(
  body: Record<string, unknown>,
  authToken: string | null | undefined,
  signal: AbortSignal | undefined,
  callbacks: MobileAgentStreamCallbacks,
  initialCursor: MobileAgentStreamCursor | null,
) {
  const serviceUrl = getAIServiceUrl();
  const response = await fetch(`${serviceUrl}/api/agent/stream`, {
    method: "POST",
    headers: buildJsonHeaders(authToken),
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Agent Stream error: ${await parseErrorResponse(response)}`);
  }

  await parseNDJSONStream(response, callbacks, initialCursor);
}

export async function streamAgent(
  params: StreamAgentParams,
  callbacks: MobileAgentStreamCallbacks,
): Promise<void> {
  try {
    await postAgentStream(
      {
        messages: params.messages,
        modelId: params.modelId,
        conversationId: params.conversationId,
        enableThinking: params.enableThinking,
        knowledgeBaseEnabled: params.knowledgeBaseEnabled ?? true,
        currentDocument: params.currentDocument ?? null,
        mode: "chat",
      },
      params.authToken,
      params.signal,
      callbacks,
      null,
    );
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export async function resumeAgentStream(
  params: ResumeAgentStreamParams,
  callbacks: MobileAgentStreamCallbacks,
): Promise<void> {
  try {
    await postAgentStream(
      {
        resume: params.cursor,
      },
      params.authToken,
      params.signal,
      callbacks,
      params.cursor,
    );
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export function getAgentStreamEventRunId(
  event: MobileAgentStreamEvent,
): string | null {
  return getEventRunId(event);
}
