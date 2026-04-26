import { describe, it, expect } from "vitest";
import { formatTime, formatRelativeTime } from "../utils";

function createMockT() {
  return (key: string, params?: any) => {
    const map: Record<string, string> = {
      justNow: "刚刚",
      minutesAgo: `${params?.count ?? 0} 分钟前`,
      hoursAgo: `${params?.count ?? 0} 小时前`,
      yesterday: "昨天",
      daysAgo: `${params?.count ?? 0} 天前`,
      weeksAgo: `${params?.count ?? 0} 周前`,
    };
    return map[key] ?? key;
  };
}

describe("formatTime", () => {
  const t = createMockT();

  it("returns null for undefined timestamp", () => {
    expect(formatTime(undefined, t)).toBeNull();
  });

  it("returns justNow for less than 1 minute ago", () => {
    const now = Date.now();
    expect(formatTime(now - 30000, t)).toBe("刚刚");
  });

  it("returns minutesAgo for less than 60 minutes ago", () => {
    const now = Date.now();
    const result = formatTime(now - 5 * 60 * 1000, t);
    expect(result).toBe("5 分钟前");
  });

  it("returns hoursAgo for less than 24 hours ago", () => {
    const now = Date.now();
    const result = formatTime(now - 3 * 60 * 60 * 1000, t);
    expect(result).toBe("3 小时前");
  });

  it("returns date string for more than 24 hours ago", () => {
    const now = Date.now();
    const twoDaysAgo = now - 48 * 60 * 60 * 1000;
    const result = formatTime(twoDaysAgo, t);
    expect(result).toMatch(/\d+年\d+月\d+日/);
  });
});

describe("formatRelativeTime", () => {
  const t = createMockT();

  it("returns justNow for less than 60 seconds ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30000, t)).toBe("刚刚");
  });

  it("returns minutesAgo for less than 60 minutes ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 10 * 60 * 1000, t)).toBe("10 分钟前");
  });

  it("returns hoursAgo for less than 24 hours ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60 * 60 * 1000, t)).toBe("5 小时前");
  });

  it("returns yesterday for 1 day ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 25 * 60 * 60 * 1000, t)).toBe("昨天");
  });

  it("returns daysAgo for 2-6 days ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 24 * 60 * 60 * 1000, t)).toBe("3 天前");
  });

  it("returns weeksAgo for 7-29 days ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 14 * 24 * 60 * 60 * 1000, t)).toBe("2 周前");
  });

  it("returns locale date string for 30+ days ago", () => {
    const now = Date.now();
    const result = formatRelativeTime(now - 60 * 24 * 60 * 60 * 1000, t);
    expect(typeof result).toBe("string");
    expect(result).not.toBe("刚刚");
  });
});
