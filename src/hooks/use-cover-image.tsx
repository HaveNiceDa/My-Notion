/**
 * 封面图片管理Hook
 * 使用zustand全局状态管理库
 * 用于管理文档封面图片的上传/替换状态
 */
import {create} from 'zustand'

type ConverImageStore = {
  url?:string // 封面图片URL
  isOpen:boolean // 封面图片上传弹窗是否打开
  onOpen:() => void // 打开封面图片上传弹窗
  onClose:() => void // 关闭封面图片上传弹窗
  onReplace:(url:string) => void // 替换封面图片（传入新的图片URL）
}

/**
 * 封面图片状态管理Hook
 * @returns 封面图片状态和操作方法
 */
export const useConverImage = create<ConverImageStore>()((set) => ({
  url:undefined,
  isOpen:false,
  onOpen:() => set({isOpen:true,url:undefined}),
  onClose:() => set({isOpen:false,url:undefined  }),
  onReplace:(url:string) => set({isOpen:true,url})
}))