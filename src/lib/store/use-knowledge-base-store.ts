import { create } from "zustand";

interface KnowledgeBaseState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useKnowledgeBaseStore = create<KnowledgeBaseState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (enabled: boolean) => set({ enabled }),
}));
