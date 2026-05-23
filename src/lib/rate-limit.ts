// In-memory sliding-window rate limiter.
// Works for single-instance (demo) deployments; across multiple serverless
// instances, use Redis or Upstash for shared state.

const counters = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  limit?:    number; // max requests per window
  windowMs?: number; // window duration in ms
}

interface RateLimitResult {
  allowed:    boolean;
  remaining:  number;
  resetAt:    number; // epoch ms
}

export function checkRateLimit(
  key:      string,
  { limit = 10, windowMs = 60_000 }: RateLimitOptions = {},
): RateLimitResult {
  const now   = Date.now();
  const entry = counters.get(key);

  if (!entry || now >= entry.resetAt) {
    // New window
    counters.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

// Prune stale entries to avoid unbounded memory growth (call periodically or on each check)
export function pruneExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of counters) {
    if (now >= entry.resetAt) counters.delete(key);
  }
}
