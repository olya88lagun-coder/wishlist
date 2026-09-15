export type RateLimiter = { allow(key: string): boolean };

const MAX_TRACKED_KEYS = 10_000;
const MINUTE_MS = 60_000;

export function createRateLimiter(p: { limit: number; windowMs: number; now?: () => number }): RateLimiter {
  const now = p.now ?? Date.now;
  const windows = new Map<string, { startedAt: number; count: number }>();
  return {
    allow(key) {
      const current = now();
      if (windows.size > MAX_TRACKED_KEYS) windows.clear();
      const window = windows.get(key);
      if (!window || current - window.startedAt >= p.windowMs) {
        windows.set(key, { startedAt: current, count: 1 });
        return true;
      }
      if (window.count >= p.limit) return false;
      windows.set(key, { startedAt: window.startedAt, count: window.count + 1 });
      return true;
    },
  };
}

export const reservationLimiter = createRateLimiter({ limit: 20, windowMs: MINUTE_MS });
export const editLimiter = createRateLimiter({ limit: 60, windowMs: MINUTE_MS });
