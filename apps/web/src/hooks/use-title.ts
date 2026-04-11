import { useEffect } from "react";

/**
 * 用于动态设置浏览器文档标题的 Hook
 * @param title - 要设置的文档标题
 * @description 当标题变化时，会直接更新浏览器标题
 */
export function useTitle(title?: string) {
  useEffect(() => {
    if (!title) {
      return;
    }
    document.title = title;
  }, [title]);
}