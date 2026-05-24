import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkRateLimit } from "../rate-limiter";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: Date.now() });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("首次请求允许通过", async () => {
    const result = await checkRateLimit("user-1");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(19);
    expect(result.limit).toBe(20);
  });

  it("连续请求递减 remaining", async () => {
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("user-remaining");
    }
    const result = await checkRateLimit("user-remaining");
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(14);
  });

  it("达到限制后拒绝请求", async () => {
    for (let i = 0; i < 20; i++) {
      await checkRateLimit("user-2");
    }
    const result = await checkRateLimit("user-2");
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("不同用户独立计数", async () => {
    for (let i = 0; i < 20; i++) {
      await checkRateLimit("user-a");
    }
    const resultA = await checkRateLimit("user-a");
    expect(resultA.success).toBe(false);

    const resultB = await checkRateLimit("user-b");
    expect(resultB.success).toBe(true);
  });

  it("滑动窗口过期后恢复配额", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    for (let i = 0; i < 20; i++) {
      await checkRateLimit("user-3");
    }
    const blocked = await checkRateLimit("user-3");
    expect(blocked.success).toBe(false);

    vi.setSystemTime(now + 60_001);
    const allowed = await checkRateLimit("user-3");
    expect(allowed.success).toBe(true);
  });

  it("被拒绝时返回正确的 reset 时间", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    for (let i = 0; i < 20; i++) {
      await checkRateLimit("user-4");
    }
    const result = await checkRateLimit("user-4");
    expect(result.success).toBe(false);
    expect(result.reset).toBeGreaterThan(now);
    expect(result.reset).toBeLessThanOrEqual(now + 60_000);
  });

  it("成功时返回正确的 reset 时间", async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    const result = await checkRateLimit("user-5");
    expect(result.success).toBe(true);
    expect(result.reset).toBeGreaterThanOrEqual(now + 60_000);
  });
});
