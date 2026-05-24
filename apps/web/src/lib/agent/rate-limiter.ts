const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

type RequestWindow = { timestamps: number[] };

const store = new Map<string, RequestWindow>();
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const cutoff = now - WINDOW_MS;
  for (const [key, window] of store) {
    window.timestamps = window.timestamps.filter((t) => t > cutoff);
    if (window.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export async function checkRateLimit(
  userId: string,
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  cleanup();

  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  let window = store.get(userId);

  if (!window) {
    window = { timestamps: [] };
    store.set(userId, window);
  }

  window.timestamps = window.timestamps.filter((t) => t > cutoff);

  const remaining = MAX_REQUESTS - window.timestamps.length;

  if (remaining <= 0) {
    const oldestInWindow = window.timestamps[0];
    const reset = oldestInWindow + WINDOW_MS;
    return { success: false, limit: MAX_REQUESTS, remaining: 0, reset };
  }

  window.timestamps.push(now);
  return { success: true, limit: MAX_REQUESTS, remaining: remaining - 1, reset: now + WINDOW_MS };
}
