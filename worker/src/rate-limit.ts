/**
 * Rate limiting with sliding window algorithm (fix P3).
 * Uses in-memory Map for simplicity (resets on worker restart).
 * For production, could be backed by D1 or Durable Objects.
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

// ── Sliding Window Store ────────────────────────────────────────────────────

const store = new Map<string, number[]>();

/**
 * Check rate limit using sliding window algorithm.
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions = RATE_LIMIT_PRESETS.api
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  // Get or create timestamps array
  let timestamps = store.get(key) || [];

  // Filter out timestamps outside the window
  timestamps = timestamps.filter((t) => t > windowStart);

  const allowed = timestamps.length < options.maxRequests;

  if (allowed) {
    timestamps.push(now);
  }

  // Trim to prevent unbounded growth
  if (timestamps.length > options.maxRequests * 2) {
    timestamps = timestamps.slice(-options.maxRequests);
  }

  store.set(key, timestamps);

  const resetAt = timestamps.length > 0
    ? timestamps[0] + options.windowMs
    : now + options.windowMs;

  return {
    allowed,
    remaining: Math.max(0, options.maxRequests - timestamps.length),
    limit: options.maxRequests,
    resetAt,
  };
}

/**
 * Reset rate limit for a key.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}

/**
 * Get rate limit info without incrementing.
 */
export function getRateLimitInfo(
  key: string,
  options: RateLimitOptions = RATE_LIMIT_PRESETS.api
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;
  const timestamps = (store.get(key) || []).filter((t) => t > windowStart);

  return {
    allowed: timestamps.length < options.maxRequests,
    remaining: Math.max(0, options.maxRequests - timestamps.length),
    limit: options.maxRequests,
    resetAt: timestamps.length > 0
      ? timestamps[0] + options.windowMs
      : now + options.windowMs,
  };
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
 * Clear all rate limit data (for testing).
 */
export function clearAllRateLimits(): void {
  store.clear();
}
