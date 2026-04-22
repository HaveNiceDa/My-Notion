import { create } from "zustand";

/**
 * 设置面板的状态管理
 * 用于控制设置弹窗的打开/关闭状态
 */
type SettingsStore = {
  /** 设置弹窗是否打开 */
  isOpen: boolean;
  /** 打开设置弹窗 */
  onOpen: () => void;
  /** 关闭设置弹窗 */
  onClose: () => void;
};

/**
 * 设置面板 Store
 * 使用 Zustand 管理设置弹窗的全局状态
 */
export const useSettings = create<SettingsStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
