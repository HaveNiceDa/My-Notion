import { create } from "zustand";

type NavigationStore = {
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
};

export const useNavigation = create<NavigationStore>((set) => ({
  isCollapsed: false,
  setIsCollapsed: (isCollapsed) => set({ isCollapsed }),
}));
