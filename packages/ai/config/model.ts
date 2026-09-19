export const AI_MODELS = [
  "qwen3.8-max-0902",
  "qwen3.8-flash",
  "qwen3.8-27b",
] as const;

export type AIModel = (typeof AI_MODELS)[number];

export const DEFAULT_MODEL: AIModel = "qwen3.8-max-0902";

export const MODEL_ID_MAPPING: Record<AIModel, string> = {
  "qwen3.8-max-0902": "qwen3.8-max-0902",
  "qwen3.8-flash": "qwen3.8-flash",
  "qwen3.8-27b": "qwen3.8-27b",
};

export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
  "qwen3.8-max-0902": "Qwen Max 0902",
  "qwen3.8-flash": "Qwen Flash",
  "qwen3.8-27b": "Qwen 27B",
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
    id: "qwen3.8-max-0902",
    actualModelId: "qwen3.8-max-0902",
    displayName: "Qwen Max 0902",
    enabled: true,
  },
  {
    id: "qwen3.8-flash",
    actualModelId: "qwen3.8-flash",
    displayName: "Qwen Flash",
    enabled: true,
  },
  {
    id: "qwen3.8-27b",
    actualModelId: "qwen3.8-27b",
    displayName: "Qwen 27B",
    enabled: true,
  },
];

export const EMB_MODEL = "tongyi-embedding-vision-plus-2026-03-06";
export const EMB_DIMENSION = 1024;
