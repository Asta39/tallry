/**
 * Best-effort in-memory rate limiter (fixed window).
 *
 * Per-instance only: on serverless each warm instance counts separately, so
 * treat limits as abuse ceilings, not precise quotas. Good enough to stop
 * token brute-forcing and scraping on the public endpoints; swap for a
 * Redis/Upstash implementation if precise global limits become necessary.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || b.resetAt <= now) {
    // Opportunistic cleanup so the map can't grow unbounded
    if (buckets.size > MAX_BUCKETS) {
      for (const [k, v] of buckets) {
        if (v.resetAt <= now) buckets.delete(k);
      }
      if (buckets.size > MAX_BUCKETS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  b.count++;
  return b.count <= limit;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : null) || req.headers.get("x-real-ip") || "unknown";
}
