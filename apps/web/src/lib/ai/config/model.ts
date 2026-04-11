// 模型ID（对外暴露的通用标识）
export const AI_MODELS = ["Model-1", "Model-2", "Model-3"] as const;

// 模型类型
export type AIModel = (typeof AI_MODELS)[number];

// 默认模型
export const DEFAULT_MODEL: AIModel = "Model-1";

// 模型实际映射（内部使用，修改这里即可切换底层模型）
export const MODEL_ID_MAPPING: Record<AIModel, string> = {
  "Model-1": "qwen3.6-plus",
  "Model-2": "qwen3.6-plus-2026-04-02",
  "Model-3": "gui-plus-2026-02-26",
};

// 模型显示名称映射（对外展示，界面显示实际模型名称）
export const MODEL_DISPLAY_NAMES: Record<AIModel, string> = {
  "Model-1": "Qwen 3.6 Plus",
  "Model-2": "Qwen 3.6 Plus 2026-04-02",
  "Model-3": "GUI Plus 2026-02-26",
};

// 获取实际模型ID的辅助函数
export function getActualModelId(model: AIModel): string {
  return MODEL_ID_MAPPING[model];
}

// 模型配置（预留扩展）
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

/**
 * 嵌入模型ID
 */
export const EMB_MODEL = "text-embedding-v4";
