import { create } from "zustand";

interface DeepThinkingState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useDeepThinkingStore = create<DeepThinkingState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (enabled: boolean) => set({ enabled }),
}));
