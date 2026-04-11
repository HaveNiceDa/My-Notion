import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import * as locales from "@blocknote/core/locales"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 映射next/intl语言到BlockNote语言
 * @param lang 语言代码，如zh-CN, en-US等
 * @returns BlockNote支持的语言代码
 */
export function getBlockNoteLocale(lang: string) {
  // 处理语言代码，例如将zh-CN映射到zh
  const langCode = lang.split('-')[0];
  
  // 检查BlockNote是否支持该语言
  if (langCode in locales) {
    return langCode as keyof typeof locales;
  }
  
  // 默认使用英语
  return "en" as keyof typeof locales;
}

/**
 * 格式化时间显示
 * @param timestamp 时间戳
 * @param t 翻译函数
 * @returns 格式化后的时间字符串
 */
export function formatTime(timestamp: number | undefined, t: (key: string, params?: any) => string) {
  if (!timestamp) return null;

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  // 1分钟内
  if (minutes < 1) {
    return t("justNow");
  }

  // 1小时内
  if (minutes < 60) {
    return t("minutesAgo", { count: minutes });
  }

  // 1-24小时
  if (hours < 24) {
    return t("hoursAgo", { count: hours });
  }

  // 超过24小时，显示具体日期（xx年xx月xx日）
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}
