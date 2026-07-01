export const AI_MODELS = [
  "kimi-k2.7-code",
  "qwen3.7-max-2026-06-08",
  "qwen3.7-plus",
  "qwen3.7-plus-2026-05-26",
] as const;

export type AIModelId = (typeof AI_MODELS)[number];

export const DEFAULT_AI_MODEL_ID: AIModelId = "kimi-k2.7-code";

export const MODEL_DISPLAY_NAMES: Record<AIModelId, string> = {
  "kimi-k2.7-code": "Kimi K2.7 Code",
  "qwen3.7-max-2026-06-08": "Qwen 3.7 Max 2026-06-08",
  "qwen3.7-plus": "Qwen 3.7 Plus",
  "qwen3.7-plus-2026-05-26": "Qwen 3.7 Plus 2026-05-26",
};

export function getInitialAIModelId(): AIModelId {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL_ID;
  const saved = localStorage.getItem("ai-model-id");
  if (saved && AI_MODELS.includes(saved as AIModelId)) {
    return saved as AIModelId;
  }
  return DEFAULT_AI_MODEL_ID;
}
