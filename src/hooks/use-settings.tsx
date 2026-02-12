/**
 * 设置功能管理Hook
 * 使用zustand全局状态管理库
 * 用于管理设置弹窗的打开/关闭状态
 */
import {create} from 'zustand'

type SettingsStore = {
  isOpen:boolean // 设置弹窗是否打开
  onOpen:() => void // 打开设置弹窗
  onClose:() => void // 关闭设置弹窗
}

/**
 * 设置状态管理Hook
 * @returns 设置弹窗状态和操作方法
 */
export const useSettings = create<SettingsStore>((set) => ({
  isOpen:false,
  onOpen:() => set({isOpen:true}),
  onClose:() => set({isOpen:false})
}))