import OpenAI from "openai";
import {
  type AIModel,
  DEFAULT_MODEL,
  getActualModelId,
  DASHSCOPE_BASE_URL,
  MODELS_CONFIG,
} from "@notion/ai/config";
import { promptLoader } from "@notion/ai/prompts";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamCallbacks = {
  onContent: (text: string) => void;
  onReasoning?: (text: string) => void;
  onError?: (error: Error) => void;
  onComplete: () => void;
};

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.EXPO_PUBLIC_LLM_API_KEY;
  if (!apiKey) {
    throw new Error("EXPO_PUBLIC_LLM_API_KEY is not configured");
  }
  return new OpenAI({
    apiKey,
    baseURL: DASHSCOPE_BASE_URL,
    dangerouslyAllowBrowser: true,
  });
}

export async function streamChat(
  messages: ChatMessage[],
  model: AIModel = DEFAULT_MODEL,
  enableThinking: boolean = false,
  callbacks: StreamCallbacks,
): Promise<void> {
  const openai = getOpenAIClient();
  const actualModelId = getActualModelId(model);

  const requestParams: any = {
    model: actualModelId,
    messages,
    stream: true,
  };

  if (enableThinking) {
    requestParams.extra_body = {
      enable_thinking: true,
      thinking_budget: 50,
    };
  }

  try {
    const response = await openai.chat.completions.create(requestParams);

    for await (const chunk of response as any) {
      const delta = chunk.choices[0]?.delta;

      const reasoningContent = enableThinking
        ? (delta as any)?.reasoning_content
        : undefined;
      if (reasoningContent) {
        callbacks.onReasoning?.(reasoningContent);
      }

      const text = delta?.content;
      if (text) {
        callbacks.onContent(text);
      }
    }

    callbacks.onComplete();
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}

export function buildMessages(
  userQuery: string,
  conversationHistory: ChatMessage[],
): ChatMessage[] {
  const { systemPrompt, userPrompt } = promptLoader.generatePrompt([], userQuery);

  return [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userPrompt },
  ];
}

export type { AIModel };
export { DEFAULT_MODEL, MODELS_CONFIG };
