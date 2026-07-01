export const AI_MODELS = [
  "kimi-k2.7-code",
  "qwen3.7-max-2026-06-08",
  "qwen3.7-plus",
  "qwen3.7-plus-2026-05-26",
] as const;

export type AIModelId = (typeof AI_MODELS)[number];

export const DEFAULT_AI_MODEL_ID: AIModelId = "kimi-k2.7-code";

export const MODEL_DISPLAY_NAMES: Record<AIModelId, string> = {
  "kimi-k2.7-code": "Kimi Code",
  "qwen3.7-max-2026-06-08": "Qwen Max",
  "qwen3.7-plus": "Qwen Plus",
  "qwen3.7-plus-2026-05-26": "Qwen Plus 0526",
};

export function getInitialAIModelId(): AIModelId {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL_ID;
  const saved = localStorage.getItem("ai-model-id");
  if (saved && AI_MODELS.includes(saved as AIModelId)) {
    return saved as AIModelId;
  }
  return DEFAULT_AI_MODEL_ID;
}
