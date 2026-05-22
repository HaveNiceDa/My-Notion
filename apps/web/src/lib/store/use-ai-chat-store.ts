import { create } from "zustand";

interface AIChatStoreState {
  panelOpen: boolean;
  panelPinned: boolean;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  togglePinned: () => void;
}

export const useAIChatStore = create<AIChatStoreState>((set) => ({
  panelOpen: false,
  panelPinned: true,
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePinned: () => set((s) => ({ panelPinned: !s.panelPinned })),
}));
