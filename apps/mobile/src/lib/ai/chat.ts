import { Platform } from "react-native";
import {
  type AIModel,
  DEFAULT_MODEL,
  MODELS_CONFIG,
  getActualModelId,
} from "@notion/ai/config";
import type { AIStreamEvent } from "@notion/ai/server";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamCallbacks = {
  onContent: (text: string) => void;
  onReasoning?: (text: string) => void;
  onThinkingStep?: (step: { type: string; content: string; details?: string }) => void;
  onToolCall?: (toolCall: any) => void;
  onError?: (error: Error) => void;
  onComplete: () => void;
};

const AI_SERVICE_URL = process.env.EXPO_PUBLIC_AI_SERVICE_URL;

function getAIServiceUrl(): string {
  if (!AI_SERVICE_URL) {
    throw new Error("EXPO_PUBLIC_AI_SERVICE_URL is not configured");
  }
  return AI_SERVICE_URL;
}

function processSSEBuffer(buffer: string, callbacks: StreamCallbacks): string {
  const lines = buffer.split("\n");

  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("data:")) {
      const dataStr = line.slice(5).trim();
      if (!dataStr) continue;

      try {
        const event: AIStreamEvent = JSON.parse(dataStr);

        switch (event.type) {
          case "content":
            callbacks.onContent(event.text);
            break;
          case "reasoning":
            callbacks.onReasoning?.(event.text);
            break;
          case "thinking_step":
            callbacks.onThinkingStep?.({
              type: event.step_type,
              content: event.content,
              details: event.details,
            });
            break;
          case "tool_call_start":
            callbacks.onToolCall?.(event);
            break;
          case "tool_executing":
            callbacks.onToolCall?.(event);
            break;
          case "tool_result":
            callbacks.onToolCall?.(event);
            break;
          case "error":
            callbacks.onError?.(new Error(event.message));
            break;
          case "done":
            break;
        }
      } catch {
        // skip malformed JSON
      }
    }
  }

  return lines[lines.length - 1];
}

async function parseSSEStreamWeb(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is not readable");

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = processSSEBuffer(buffer, callbacks);
  }

  reader.releaseLock();
}

async function parseSSEStreamNative(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<void> {
  const text = await response.text();
  processSSEBuffer(text + "\n", callbacks);
}

async function parseSSEStream(
  response: Response,
  callbacks: StreamCallbacks,
): Promise<void> {
  if (Platform.OS === "web") {
    await parseSSEStreamWeb(response, callbacks);
  } else {
    await parseSSEStreamNative(response, callbacks);
  }
}

export async function streamChat(
  messages: ChatMessage[],
  model: AIModel = DEFAULT_MODEL,
  enableThinking: boolean = false,
  callbacks: StreamCallbacks,
): Promise<void> {
  const serviceUrl = getAIServiceUrl();
  const actualModelId = getActualModelId(model);

  try {
    const response = await fetch(`${serviceUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        model: actualModelId,
        enableThinking,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Service error: ${response.status} ${response.statusText}`);
    }

    await parseSSEStream(response, callbacks);
    callbacks.onComplete();
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export type RAGStreamParams = {
  userId: string;
  query: string;
  model: AIModel;
  conversationHistory: ChatMessage[];
  conversationId?: string;
  enableThinking?: boolean;
  knowledgeBaseEnabled?: boolean;
};

export async function streamRAG(
  params: RAGStreamParams,
  callbacks: StreamCallbacks,
): Promise<void> {
  const serviceUrl = getAIServiceUrl();
  const actualModelId = getActualModelId(params.model);

  try {
    const response = await fetch(`${serviceUrl}/api/rag`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: params.userId,
        query: params.query,
        model: actualModelId,
        conversationHistory: params.conversationHistory,
        conversationId: params.conversationId,
        enableThinking: params.enableThinking,
        knowledgeBaseEnabled: params.knowledgeBaseEnabled ?? true,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Service RAG error: ${response.status} ${response.statusText}`);
    }

    await parseSSEStream(response, callbacks);
    callbacks.onComplete();
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export function buildMessages(
  userQuery: string,
  conversationHistory: ChatMessage[],
): ChatMessage[] {
  return [
    { role: "user", content: userQuery },
    ...conversationHistory,
  ];
}

export type { AIModel };
export { DEFAULT_MODEL, MODELS_CONFIG };
