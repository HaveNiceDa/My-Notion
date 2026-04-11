export const AI_MODELS = ["Model-1", "Model-2", "Model-3"] as const;

export type AIModel = (typeof AI_MODELS)[number];

export const DEFAULT_MODEL: AIModel = "Model-1";

export const MODEL_ID_MAPPING: Record<AIModel, string> = {
  "Model-1": "qwen3.6-plus",
  "Model-2": "qwen3.6-plus-2026-04-02",
  "Model-3": "gui-plus-2026-02-26",
};

export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
  "Model-1": "Qwen 3.6 Plus",
  "Model-2": "Qwen 3.6 Plus 2026-04-02",
  "Model-3": "GUI Plus 2026-02-26",
};

export function getActualModelId(model: AIModel): string {
  return MODEL_ID_MAPPING[model];
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
    id: "Model-1",
    actualModelId: "qwen3.6-plus",
    displayName: "Qwen 3.6 Plus",
    enabled: true,
  },
  {
    id: "Model-2",
    actualModelId: "qwen3.6-plus-2026-04-02",
    displayName: "Qwen 3.6 Plus 2026-04-02",
    enabled: true,
  },
  {
    id: "Model-3",
    actualModelId: "gui-plus-2026-02-26",
    displayName: "GUI Plus 2026-02-26",
    enabled: true,
  },
];

export const EMB_MODEL = "text-embedding-v4";
