import { create } from "zustand";

/**
 * 导航栏的状态管理
 * 用于控制侧栏的折叠/展开状态，以及全局弹窗的打开/关闭状态
 */
type NavigationStore = {
  /** 侧栏是否折叠 */
  isCollapsed: boolean;
  /** 设置侧栏折叠状态 */
  setIsCollapsed: (isCollapsed: boolean) => void;

  /** AI 对话弹窗是否打开 */
  isAiChatOpen: boolean;
  /** 打开 AI 对话弹窗 */
  openAiChat: () => void;
  /** 关闭 AI 对话弹窗 */
  closeAiChat: () => void;

  /** 收件箱弹窗是否打开 */
  isInboxOpen: boolean;
  /** 打开收件箱弹窗 */
  openInbox: () => void;
  /** 关闭收件箱弹窗 */
  closeInbox: () => void;
};

/**
 * 导航栏 Store
 * 使用 Zustand 管理侧栏折叠和全局弹窗的状态
 */
export const useNavigation = create<NavigationStore>((set) => ({
  isCollapsed: false,
  setIsCollapsed: (isCollapsed) => set({ isCollapsed }),

  isAiChatOpen: false,
  openAiChat: () => set({ isAiChatOpen: true }),
  closeAiChat: () => set({ isAiChatOpen: false }),

  isInboxOpen: false,
  openInbox: () => set({ isInboxOpen: true }),
  closeInbox: () => set({ isInboxOpen: false }),
}));
