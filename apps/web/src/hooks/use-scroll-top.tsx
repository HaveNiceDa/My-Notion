/**
 * 监听页面滚动位置的Hook
 * 用于判断页面是否已滚动超过指定阈值
 * @param threshold 滚动阈值，默认10px
 * @returns 是否已滚动超过阈值的布尔值
 */
import { useState, useEffect } from "react";

/**
 * 监听页面滚动位置的Hook
 * 用于判断页面是否已滚动超过指定阈值
 * @param threshold 滚动阈值，默认10px
 * @returns 是否已滚动超过阈值的布尔值
 */
export const useScrollTop = (threshold = 10) => {
  const [scrolled, setScrolled] = useState(false); // 是否已滚动超过阈值

  useEffect(() => {
    // 滚动事件处理函数
    const handleScroll = () => {
      if (window.scrollY > threshold) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll); // 添加滚动事件监听
    return () => window.removeEventListener("scroll", handleScroll); // 清理事件监听
  }, [threshold]);

  return scrolled;
}