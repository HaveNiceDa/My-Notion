import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const isDev = process.env.NODE_ENV === "development";

export function devLog(...args: unknown[]) {
  if (isDev) console.log(...args);
}

export function devWarn(...args: unknown[]) {
  if (isDev) console.warn(...args);
}

export function formatTime(timestamp: number | undefined, t: (key: string, params?: any) => string) {
  if (!timestamp) return null;

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (minutes < 1) {
    return t("justNow");
  }

  if (minutes < 60) {
    return t("minutesAgo", { count: minutes });
  }

  if (hours < 24) {
    return t("hoursAgo", { count: hours });
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

export const formatRelativeTime = (
  timestamp: number,
  t: (key: string, params?: Record<string, any>) => string
): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffTime / 1000);
  const diffMinutes = Math.floor(diffTime / (1000 * 60));
  const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffSeconds < 60) {
    return t("justNow");
  } else if (diffMinutes < 60) {
    return t("minutesAgo", { count: diffMinutes });
  } else if (diffHours < 24) {
    return t("hoursAgo", { count: diffHours });
  } else if (diffDays === 1) {
    return t("yesterday");
  } else if (diffDays < 7) {
    return t("daysAgo", { count: diffDays });
  } else if (diffDays < 30) {
    return t("weeksAgo", { count: Math.floor(diffDays / 7) });
  } else {
    return date.toLocaleDateString();
  }
};
