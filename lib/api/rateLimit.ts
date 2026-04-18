// Shared in-memory rate-limit bucket.
//
// Each route used to carry its own Map<string, {count, firstAt}> plus
// copy-pasted trip-and-record logic. That's fine functionally, but every
// copy had the same quiet bug: IPs that hit the endpoint once and never
// returned within the window sat in the map forever. On a long-lived
// container that leaks memory.
//
// This module consolidates the pattern in one place and runs an
// opportunistic sweep (when the map grows past a threshold) to evict
// entries whose window has already expired. No background timer, no
// per-request O(n) scan — only a sweep when there's something to sweep.
//
// Use for a single-container deploy. Move to Redis/KV if we ever
// horizontally scale (bucket counts drift across replicas otherwise).

export type Bucket = { count: number; firstAt: number };

const SWEEP_THRESHOLD = 1000;

export function createRateLimitBucket() {
  const map = new Map<string, Bucket>();

  function sweep(windowMs: number): void {
    if (map.size < SWEEP_THRESHOLD) return;
    const now = Date.now();
    for (const [key, bucket] of map) {
      if (now - bucket.firstAt > windowMs) map.delete(key);
    }
  }

  /**
   * Returns true if the key has exceeded `limit` hits in `windowMs`.
   * Records the hit when not limited (so a successful check counts
   * toward the budget).
   */
  function tripAndRecord(key: string, limit: number, windowMs: number): boolean {
    sweep(windowMs);
    const now = Date.now();
    const prev = map.get(key);
    if (prev && now - prev.firstAt > windowMs) map.delete(key);
    const cur = map.get(key);
    if (cur && cur.count >= limit) return true;
    if (!cur) map.set(key, { count: 1, firstAt: now });
    else cur.count++;
    return false;
  }

  return { tripAndRecord };
}

/**
 * Simple last-seen map, same opportunistic-sweep strategy.
 * Use for cooldown-style checks (min gap between submissions).
 */
export function createLastSeenBucket(defaultWindowMs: number) {
  const map = new Map<string, number>();

  function sweep(): void {
    if (map.size < SWEEP_THRESHOLD) return;
    const now = Date.now();
    for (const [key, ts] of map) {
      if (now - ts > defaultWindowMs) map.delete(key);
    }
  }

  function get(key: string): number | undefined {
    return map.get(key);
  }

  function set(key: string, ts: number): void {
    sweep();
    map.set(key, ts);
  }

  return { get, set };
}
