/**
 * 搜索功能管理Hook
 * 使用zustand全局状态管理库
 * 用于管理搜索弹窗的打开/关闭状态
 */
import {create} from 'zustand'

type SearchStore = {
  isOpen:boolean // 搜索弹窗是否打开
  onOpen:() => void // 打开搜索弹窗
  onClose:() => void // 关闭搜索弹窗
  toggle:() => void // 切换搜索弹窗状态
}

/**
 * 搜索状态管理Hook
 * @returns 搜索弹窗状态和操作方法
 */
export const useSearch = create<SearchStore>((set,get) => ({
  isOpen:false,
  onOpen:() => set({isOpen:true}),
  onClose:() => set({isOpen:false}),
  toggle:() => set({isOpen:!get().isOpen})
}))