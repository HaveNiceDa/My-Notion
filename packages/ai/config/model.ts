export const AI_MODELS = [
  "kimi-k2.7-code",
  "qwen3.7-max-2026-06-08",
  "qwen3.7-plus",
  "qwen3.7-plus-2026-05-26",
] as const;

export type AIModel = (typeof AI_MODELS)[number];

export const DEFAULT_MODEL: AIModel = "kimi-k2.7-code";

export const MODEL_ID_MAPPING: Record<AIModel, string> = {
  "kimi-k2.7-code": "kimi-k2.7-code",
  "qwen3.7-max-2026-06-08": "qwen3.7-max-2026-06-08",
  "qwen3.7-plus": "qwen3.7-plus",
  "qwen3.7-plus-2026-05-26": "qwen3.7-plus-2026-05-26",
};

export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
  "kimi-k2.7-code": "Kimi K2.7 Code",
  "qwen3.7-max-2026-06-08": "Qwen 3.7 Max 2026-06-08",
  "qwen3.7-plus": "Qwen 3.7 Plus",
  "qwen3.7-plus-2026-05-26": "Qwen 3.7 Plus 2026-05-26",
};

const AI_MODEL_SET = new Set<string>(AI_MODELS);

export function isAIModel(model: unknown): model is AIModel {
  return typeof model === "string" && AI_MODEL_SET.has(model);
}

export function getActualModelId(model: string): string {
  if (isAIModel(model)) {
    return MODEL_ID_MAPPING[model as AIModel];
  }
  throw new Error(`Unsupported AI model: ${model}`);
}

export function resolveAllowedModelId(
  model: unknown,
  fallback: AIModel = DEFAULT_MODEL,
): string {
  const requestedModel = typeof model === "string" && model.trim()
    ? model.trim()
    : fallback;

  if (!isAIModel(requestedModel)) {
    throw new Error(`Unsupported AI model: ${requestedModel}`);
  }

  return getActualModelId(requestedModel);
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
    id: "kimi-k2.7-code",
    actualModelId: "kimi-k2.7-code",
    displayName: "Kimi K2.7 Code",
    enabled: true,
  },
  {
    id: "qwen3.7-max-2026-06-08",
    actualModelId: "qwen3.7-max-2026-06-08",
    displayName: "Qwen 3.7 Max 2026-06-08",
    enabled: true,
  },
  {
    id: "qwen3.7-plus",
    actualModelId: "qwen3.7-plus",
    displayName: "Qwen 3.7 Plus",
    enabled: true,
  },
  {
    id: "qwen3.7-plus-2026-05-26",
    actualModelId: "qwen3.7-plus-2026-05-26",
    displayName: "Qwen 3.7 Plus 2026-05-26",
    enabled: true,
  },
];

export const EMB_MODEL = "tongyi-embedding-vision-plus-2026-03-06";
export const EMB_DIMENSION = 1024;
