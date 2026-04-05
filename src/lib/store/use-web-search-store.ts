import { create } from "zustand";

interface WebSearchState {
  enabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

export const useWebSearchStore = create<WebSearchState>((set) => ({
  enabled: false,
  toggle: () => set((state) => ({ enabled: !state.enabled })),
  setEnabled: (enabled: boolean) => set({ enabled }),
}));
