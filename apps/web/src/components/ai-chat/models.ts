export const AI_MODELS = [
  "deepseek-v4-pro",
  "qwen3.6-27b",
  "kimi-k2.6",
  "glm-5.1",
] as const;

export type AIModelId = (typeof AI_MODELS)[number];

export const DEFAULT_AI_MODEL_ID: AIModelId = "deepseek-v4-pro";

export const MODEL_DISPLAY_NAMES: Record<AIModelId, string> = {
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "qwen3.6-27b": "Qwen 3.6 27B",
  "kimi-k2.6": "Kimi K2.6",
  "glm-5.1": "GLM 5.1",
};

export const CHAT_MODES = ["chat", "rag"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export function getInitialAIModelId(): AIModelId {
  if (typeof window === "undefined") return DEFAULT_AI_MODEL_ID;
  const saved = localStorage.getItem("ai-model-id");
  if (saved && AI_MODELS.includes(saved as AIModelId)) {
    return saved as AIModelId;
  }
  return DEFAULT_AI_MODEL_ID;
}
