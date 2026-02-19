import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const AI_MODELS = ["qwen-plus", "qwen-max", "qwen3-coder-plus"] as const;

export type AIModel = (typeof AI_MODELS)[number];

interface AIModelStore {
  model: AIModel;
  setModel: (model: AIModel) => void;
}

export const useAIModelStore = create<AIModelStore>()(
  persist(
    (set) => ({
      model: "qwen-max",
      setModel: (model) => set({ model }),
    }),
    {
      name: "ai-model-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
