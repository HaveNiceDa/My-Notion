export const AI_MODELS = [
  "deepseek-v4-pro",
  "qwen3.6-27b",
  "kimi-k2.6",
  "glm-5.1",
] as const;

export type AIModel = (typeof AI_MODELS)[number];

export const DEFAULT_MODEL: AIModel = "deepseek-v4-pro";

export const MODEL_ID_MAPPING: Record<AIModel, string> = {
  "deepseek-v4-pro": "deepseek-v4-pro",
  "qwen3.6-27b": "qwen3.6-27b",
  "kimi-k2.6": "kimi-k2.6",
  "glm-5.1": "glm-5.1",
};

export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
  "deepseek-v4-pro": "DeepSeek V4 Pro",
  "qwen3.6-27b": "Qwen 3.6 27B",
  "kimi-k2.6": "Kimi K2.6",
  "glm-5.1": "GLM 5.1",
};

export function getActualModelId(model: string): string {
  if (model in MODEL_ID_MAPPING) {
    return MODEL_ID_MAPPING[model as AIModel];
  }
  return model;
}

export interface ModelConfig {
  id: AIModel;
  actualModelId: string;
  displayName: string;
  description?: string;
  maxTokens?: number;
  enabled: boolean;
}

export const MODELS_CONFIG: ModelConfig[] = [
  {
    id: "deepseek-v4-pro",
    actualModelId: "deepseek-v4-pro",
    displayName: "DeepSeek V4 Pro",
    enabled: true,
  },
  {
    id: "qwen3.6-27b",
    actualModelId: "qwen3.6-27b",
    displayName: "Qwen 3.6 27B",
    enabled: true,
  },
  {
    id: "kimi-k2.6",
    actualModelId: "kimi-k2.6",
    displayName: "Kimi K2.6",
    enabled: true,
  },
  {
    id: "glm-5.1",
    actualModelId: "glm-5.1",
    displayName: "GLM 5.1",
    enabled: true,
  },
];

export const EMB_MODEL = "tongyi-embedding-vision-plus-2026-03-06";
export const EMB_DIMENSION = 1024;
