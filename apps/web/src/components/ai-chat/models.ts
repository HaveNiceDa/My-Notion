export const AI_MODELS = [
  "qwen3.8-max-0902",
  "qwen3.8-flash",
  "qwen3.8-27b",
] as const;

export type AIModelId = (typeof AI_MODELS)[number];

export const DEFAULT_AI_MODEL_ID: AIModelId = "qwen3.8-max-0902";

export const MODEL_DISPLAY_NAMES: Record<AIModelId, string> = {
  "qwen3.8-max-0902": "Qwen Max 0902",
  "qwen3.8-flash": "Qwen Flash",
  "qwen3.8-27b": "Qwen 27B",
};

export function getInitialAIModelId(): AIModelId {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL_ID;
  const saved = localStorage.getItem("ai-model-id");
  if (saved && AI_MODELS.includes(saved as AIModelId)) {
    return saved as AIModelId;
  }
  return DEFAULT_AI_MODEL_ID;
}
