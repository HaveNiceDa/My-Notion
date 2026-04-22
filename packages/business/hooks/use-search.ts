import { create } from "zustand";

/**
 * 搜索面板的状态管理
 * 用于控制搜索弹窗的打开/关闭状态
 */
type SearchStore = {
  /** 搜索弹窗是否打开 */
  isOpen: boolean;
  /** 打开搜索弹窗 */
  onOpen: () => void;
  /** 关闭搜索弹窗 */
  onClose: () => void;
  /** 切换搜索弹窗状态 */
  toggle: () => void;
};

/**
 * 搜索面板 Store
 * 使用 Zustand 管理搜索弹窗的全局状态
 */
export const useSearch = create<SearchStore>((set, get) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen }),
}));
