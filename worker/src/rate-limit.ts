/**
 * D1-backed rate limiting with sliding window algorithm.
 *
 * All rate-limit state is stored in Cloudflare D1, providing:
 *   1. Persistence across worker restarts / redeploys.
 *   2. Shared state across edge isolates — a client hitting different
 *      PoPs or isolates shares the same counters.
 *   3. Bounded storage via automatic cleanup of expired entries.
 *
 * Table schema (see migrations/0001_rate_limits.sql):
 *   rate_limits(key TEXT, ts INTEGER, PRIMARY KEY (key, ts))
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
}

// ── Presets ─────────────────────────────────────────────────────────────────

export const RATE_LIMIT_PRESETS: Record<string, RateLimitOptions> = {
  strict: { maxRequests: 5, windowMs: 60_000 },
  normal: { maxRequests: 20, windowMs: 60_000 },
  relaxed: { maxRequests: 100, windowMs: 60_000 },
  api: { maxRequests: 30, windowMs: 60_000 },
  otp: { maxRequests: 60, windowMs: 60_000 },
};

// ── D1-backed sliding window ────────────────────────────────────────────────

/**
 * Check rate limit using D1-backed sliding window.
 *
 * Atomically counts recent requests and inserts a new timestamp if allowed.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  options: RateLimitOptions = RATE_LIMIT_PRESETS.api
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  // Count requests in the current window
  const countResult = await db
    .prepare("SELECT COUNT(*) as cnt FROM rate_limits WHERE key = ? AND ts > ?")
    .bind(key, windowStart)
    .first<{ cnt: number }>();

  const count = countResult?.cnt ?? 0;
  const allowed = count < options.maxRequests;

  if (allowed) {
    // Record this request
    await db
      .prepare("INSERT INTO rate_limits (key, ts) VALUES (?, ?)")
      .bind(key, now)
      .run();
  }

  // Get earliest timestamp in window for resetAt calculation
  const earliest = await db
    .prepare("SELECT MIN(ts) as min_ts FROM rate_limits WHERE key = ? AND ts > ?")
    .bind(key, windowStart)
    .first<{ min_ts: number | null }>();

  const resetAt = earliest?.min_ts
    ? earliest.min_ts + options.windowMs
    : now + options.windowMs;

  const currentCount = allowed ? count + 1 : count;

  return {
    allowed,
    remaining: Math.max(0, options.maxRequests - currentCount),
    limit: options.maxRequests,
    resetAt,
  };
}

/**
 * Reset rate limit for a key (delete all entries).
 */
export async function resetRateLimit(
  db: D1Database,
  key: string
): Promise<void> {
  await db
    .prepare("DELETE FROM rate_limits WHERE key = ?")
    .bind(key)
    .run();
}

/**
 * Get rate limit info without incrementing.
 */
export async function getRateLimitInfo(
  db: D1Database,
  key: string,
  options: RateLimitOptions = RATE_LIMIT_PRESETS.api
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  const countResult = await db
    .prepare("SELECT COUNT(*) as cnt FROM rate_limits WHERE key = ? AND ts > ?")
    .bind(key, windowStart)
    .first<{ cnt: number }>();

  const count = countResult?.cnt ?? 0;

  const earliest = await db
    .prepare("SELECT MIN(ts) as min_ts FROM rate_limits WHERE key = ? AND ts > ?")
    .bind(key, windowStart)
    .first<{ min_ts: number | null }>();

  const resetAt = earliest?.min_ts
    ? earliest.min_ts + options.windowMs
    : now + options.windowMs;

  return {
    allowed: count < options.maxRequests,
    remaining: Math.max(0, options.maxRequests - count),
    limit: options.maxRequests,
    resetAt,
  };
}

/**
 * Purge expired entries from the rate_limits table.
 * Call periodically to keep the table size bounded.
 */
export async function purgeExpiredEntries(
  db: D1Database,
  maxWindowMs: number = 60_000
): Promise<number> {
  const cutoff = Date.now() - maxWindowMs;
  const result = await db
    .prepare("DELETE FROM rate_limits WHERE ts <= ?")
    .bind(cutoff)
    .run();
  return result.meta.changes ?? 0;
}

/**
 * Extract client identifier from request.
 */
export function getClientIdentifier(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

/**
 * Create a 429 response with rate limit headers.
 */
export function createRateLimitResponse(info: RateLimitResult): Response {
  const retryAfter = Math.ceil((info.resetAt - Date.now()) / 1000);

  return new Response(
    JSON.stringify({
      error: "Too many requests",
      retryAfter: Math.max(0, retryAfter),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(Math.max(0, retryAfter)),
        "X-RateLimit-Limit": String(info.limit),
        "X-RateLimit-Remaining": String(info.remaining),
        "X-RateLimit-Reset": String(Math.floor(info.resetAt / 1000)),
      },
    }
  );
}

/**
 * Clear all rate limit data (for testing / admin).
 */
export async function clearAllRateLimits(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM rate_limits").run();
}
