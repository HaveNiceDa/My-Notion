import { create } from "zustand";

/**
 * 导航栏的状态管理
 * 用于控制侧栏的折叠/展开状态
 */
type NavigationStore = {
  /** 侧栏是否折叠 */
  isCollapsed: boolean;
  /** 设置侧栏折叠状态 */
  setIsCollapsed: (isCollapsed: boolean) => void;
};

/**
 * 导航栏 Store
 * 使用 Zustand 管理侧栏折叠的全局状态
 */
export const useNavigation = create<NavigationStore>((set) => ({
  isCollapsed: false,
  setIsCollapsed: (isCollapsed) => set({ isCollapsed }),
}));
