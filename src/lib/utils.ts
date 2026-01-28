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
