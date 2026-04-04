import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  AI_MODELS,
  type AIModel,
  DEFAULT_MODEL,
} from "@/src/lib/ai/config/model";

export { AI_MODELS, type AIModel };

interface AIModelStore {
  model: AIModel;
  setModel: (model: AIModel) => void;
}

export const useAIModelStore = create<AIModelStore>()(
  persist(
    (set) => ({
      model: DEFAULT_MODEL,
      setModel: (model) => set({ model }),
    }),
    {
      name: "ai-model-storage",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
