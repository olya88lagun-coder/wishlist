export type Clock = { now(): number; sleep(ms: number): Promise<void> };

const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

const PRUNE_THRESHOLD = 500;

export function createHostThrottle(minIntervalMs: number, clock: Clock = systemClock): (url: string) => Promise<void> {
  const nextSlot = new Map<string, number>();
  return async (url) => {
    const host = new URL(url).hostname;
    const now = clock.now();
    if (nextSlot.size > PRUNE_THRESHOLD) {
      for (const [key, slot] of nextSlot) if (slot < now) nextSlot.delete(key);
    }
    // слот резервируется синхронно, до ожидания, поэтому параллельные вызовы выстраиваются в очередь
    const slot = Math.max(now, nextSlot.get(host) ?? 0);
    nextSlot.set(host, slot + minIntervalMs);
    if (slot > now) await clock.sleep(slot - now);
  };
}
