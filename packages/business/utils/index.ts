import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

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
