/**
 * 获取当前页面origin（域名）的Hook
 * 处理了服务端渲染的情况，确保在客户端环境下获取正确的origin
 * @returns 当前页面的origin字符串
 */
import { useEffect, useState } from "react";

/**
 * 获取当前页面origin（域名）的Hook
 * 处理了服务端渲染的情况，确保在客户端环境下获取正确的origin
 * @returns 当前页面的origin字符串
 */
export function useOrigin () {

  const [mounted,setMounted] = useState(false) // 标记组件是否已挂载（客户端环境）

  // 只有在客户端环境下才获取window.location.origin
  const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : ''
  
  useEffect(() => {
    setMounted(true) // 组件挂载后设置为true
  },[])

  if (!mounted) return "" // 服务端渲染时返回空字符串

  return origin
}
