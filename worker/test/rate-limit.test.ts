/**
 * Rate limiting tests (D1-backed).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  getRateLimitInfo,
  getClientIdentifier,
  createRateLimitResponse,
  clearAllRateLimits,
  purgeExpiredEntries,
  RATE_LIMIT_PRESETS,
} from "../src/rate-limit";

// ── D1 mock ──────────────────────────────────────────────────────────────────

/** Minimal in-memory D1Database mock for testing. */
function createMockD1(): D1Database {
  let rows: { key: string; ts: number }[] = [];

  const mockDB = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (sql.includes("COUNT(*)")) {
                const [key, ts] = params as [string, number];
                const count = rows.filter(
                  (r) => r.key === key && r.ts > ts
                ).length;
                return { cnt: count } as T;
              }
              if (sql.includes("MIN(ts)")) {
                const [key, ts] = params as [string, number];
                const matching = rows
                  .filter((r) => r.key === key && r.ts > ts)
                  .sort((a, b) => a.ts - b.ts);
                return {
                  min_ts: matching.length > 0 ? matching[0].ts : null,
                } as T;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO rate_limits")) {
                const [key, ts] = params as [string, number];
                rows.push({ key, ts });
                return { meta: { changes: 1 } };
              }
              if (
                sql.includes("DELETE FROM rate_limits WHERE key = ?") &&
                !sql.includes("ts")
              ) {
                const [key] = params as [string];
                const before = rows.length;
                rows = rows.filter((r) => r.key !== key);
                return { meta: { changes: before - rows.length } };
              }
              if (sql.includes("DELETE FROM rate_limits WHERE ts <=")) {
                const [cutoff] = params as [number];
                const before = rows.length;
                rows = rows.filter((r) => r.ts > cutoff);
                return { meta: { changes: before - rows.length } };
              }
              // DELETE all
              if (sql.includes("DELETE FROM rate_limits")) {
                const count = rows.length;
                rows = [];
                return { meta: { changes: count } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
        // No-bind variants (for DELETE FROM rate_limits with no params)
        async run() {
          if (sql.includes("DELETE FROM rate_limits")) {
            const count = rows.length;
            rows = [];
            return { meta: { changes: count } };
          }
          return { meta: { changes: 0 } };
        },
      };
    },
  } as unknown as D1Database;

  return mockDB;
}

// ── Setup ────────────────────────────────────────────────────────────────────

let db: D1Database;

beforeEach(async () => {
  db = createMockD1();
  await clearAllRateLimits(db);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  it("allows requests within limit", async () => {
    const result = await checkRateLimit(db, "test-key", {
      maxRequests: 5,
      windowMs: 60000,
    });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("blocks after limit is exceeded", async () => {
    const options = { maxRequests: 3, windowMs: 60000 };
    await checkRateLimit(db, "test-key", options);
    await checkRateLimit(db, "test-key", options);
    await checkRateLimit(db, "test-key", options);
    const result = await checkRateLimit(db, "test-key", options);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", async () => {
    const options = { maxRequests: 1, windowMs: 60000 };
    await checkRateLimit(db, "key-1", options);
    const result = await checkRateLimit(db, "key-2", options);
    expect(result.allowed).toBe(true);
  });

  it("returns correct remaining count", async () => {
    const options = { maxRequests: 5, windowMs: 60000 };
    await checkRateLimit(db, "test-key", options); // 1 of 5
    await checkRateLimit(db, "test-key", options); // 2 of 5
    const result = await checkRateLimit(db, "test-key", options); // 3 of 5
    expect(result.remaining).toBe(2);
  });

  it("includes resetAt timestamp", async () => {
    const result = await checkRateLimit(db, "test-key", {
      maxRequests: 5,
      windowMs: 60000,
    });
    expect(result.resetAt).toBeGreaterThan(Date.now() - 1000);
  });

  it("uses api preset by default", async () => {
    const result = await checkRateLimit(db, "test-key");
    expect(result.limit).toBe(RATE_LIMIT_PRESETS.api.maxRequests);
  });
});

describe("resetRateLimit", () => {
  it("resets a rate limit key", async () => {
    const options = { maxRequests: 1, windowMs: 60000 };
    await checkRateLimit(db, "test-key", options);
    const blocked = await checkRateLimit(db, "test-key", options);
    expect(blocked.allowed).toBe(false);

    await resetRateLimit(db, "test-key");
    const after = await checkRateLimit(db, "test-key", options);
    expect(after.allowed).toBe(true);
  });
});

describe("getRateLimitInfo", () => {
  it("returns info without incrementing", async () => {
    const options = { maxRequests: 3, windowMs: 60000 };
    await checkRateLimit(db, "test-key", options); // count = 1

    const info = await getRateLimitInfo(db, "test-key", options);
    expect(info.remaining).toBe(2);

    // Should still be 2 (not incremented)
    const info2 = await getRateLimitInfo(db, "test-key", options);
    expect(info2.remaining).toBe(2);
  });

  it("reports allowed status correctly", async () => {
    const options = { maxRequests: 1, windowMs: 60000 };
    await checkRateLimit(db, "test-key", options);
    const info = await getRateLimitInfo(db, "test-key", options);
    expect(info.allowed).toBe(false);
  });
});

describe("getClientIdentifier", () => {
  it("extracts cf-connecting-ip", () => {
    const req = new Request("https://example.com", {
      headers: { "cf-connecting-ip": "1.2.3.4" },
    });
    expect(getClientIdentifier(req)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip", () => {
    const req = new Request("https://example.com", {
      headers: { "x-real-ip": "5.6.7.8" },
    });
    expect(getClientIdentifier(req)).toBe("5.6.7.8");
  });

  it("falls back to x-forwarded-for", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "9.10.11.12, 13.14.15.16" },
    });
    expect(getClientIdentifier(req)).toBe("9.10.11.12");
  });

  it("returns unknown when no headers", () => {
    const req = new Request("https://example.com");
    expect(getClientIdentifier(req)).toBe("unknown");
  });
});

describe("createRateLimitResponse", () => {
  it("returns 429 with correct headers", () => {
    const info = {
      allowed: false,
      remaining: 0,
      limit: 5,
      resetAt: Date.now() + 30000,
    };

    const response = createRateLimitResponse(info);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeDefined();
    expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("RATE_LIMIT_PRESETS", () => {
  it("has all expected presets", () => {
    expect(RATE_LIMIT_PRESETS.strict).toBeDefined();
    expect(RATE_LIMIT_PRESETS.normal).toBeDefined();
    expect(RATE_LIMIT_PRESETS.relaxed).toBeDefined();
    expect(RATE_LIMIT_PRESETS.api).toBeDefined();
    expect(RATE_LIMIT_PRESETS.otp).toBeDefined();
  });

  it("strict is more restrictive than normal", () => {
    expect(RATE_LIMIT_PRESETS.strict.maxRequests).toBeLessThan(
      RATE_LIMIT_PRESETS.normal.maxRequests
    );
  });
});

describe("sliding window behavior", () => {
  it("allows burst then blocks", async () => {
    const options = { maxRequests: 3, windowMs: 100 };

    // Burst: 3 requests should be allowed
    expect((await checkRateLimit(db, "burst", options)).allowed).toBe(true);
    expect((await checkRateLimit(db, "burst", options)).allowed).toBe(true);
    expect((await checkRateLimit(db, "burst", options)).allowed).toBe(true);

    // 4th should be blocked
    expect((await checkRateLimit(db, "burst", options)).allowed).toBe(false);
  });
});

describe("purgeExpiredEntries", () => {
  it("removes expired entries", async () => {
    const options = { maxRequests: 10, windowMs: 60000 };

    // Insert entries
    await checkRateLimit(db, "old-key", options);
    await checkRateLimit(db, "old-key", options);

    // Purge with a very large window (nothing expired)
    const purged0 = await purgeExpiredEntries(db, 999_999_999);
    expect(purged0).toBe(0);

    // Purge with window=0 (everything is expired)
    const purged = await purgeExpiredEntries(db, 0);
    expect(purged).toBe(2);
  });
});
