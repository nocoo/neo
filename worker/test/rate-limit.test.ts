/**
 * Rate limiting tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  resetRateLimit,
  getRateLimitInfo,
  getClientIdentifier,
  createRateLimitResponse,
  clearAllRateLimits,
  RATE_LIMIT_PRESETS,
} from "../src/rate-limit";

beforeEach(() => {
  clearAllRateLimits();
});

describe("checkRateLimit", () => {
  it("allows requests within limit", () => {
    const result = checkRateLimit("test-key", { maxRequests: 5, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("blocks after limit is exceeded", () => {
    const options = { maxRequests: 3, windowMs: 60000 };
    checkRateLimit("test-key", options);
    checkRateLimit("test-key", options);
    checkRateLimit("test-key", options);
    const result = checkRateLimit("test-key", options);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different keys independently", () => {
    const options = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit("key-1", options);
    const result = checkRateLimit("key-2", options);
    expect(result.allowed).toBe(true);
  });

  it("returns correct remaining count", () => {
    const options = { maxRequests: 5, windowMs: 60000 };
    checkRateLimit("test-key", options); // 1 of 5
    checkRateLimit("test-key", options); // 2 of 5
    const result = checkRateLimit("test-key", options); // 3 of 5
    expect(result.remaining).toBe(2);
  });

  it("includes resetAt timestamp", () => {
    const result = checkRateLimit("test-key", { maxRequests: 5, windowMs: 60000 });
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("uses api preset by default", () => {
    const result = checkRateLimit("test-key");
    expect(result.limit).toBe(RATE_LIMIT_PRESETS.api.maxRequests);
  });
});

describe("resetRateLimit", () => {
  it("resets a rate limit key", () => {
    const options = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit("test-key", options);
    const blocked = checkRateLimit("test-key", options);
    expect(blocked.allowed).toBe(false);

    resetRateLimit("test-key");
    const after = checkRateLimit("test-key", options);
    expect(after.allowed).toBe(true);
  });
});

describe("getRateLimitInfo", () => {
  it("returns info without incrementing", () => {
    const options = { maxRequests: 3, windowMs: 60000 };
    checkRateLimit("test-key", options); // count = 1

    const info = getRateLimitInfo("test-key", options);
    expect(info.remaining).toBe(2);

    // Should still be 2 (not incremented)
    const info2 = getRateLimitInfo("test-key", options);
    expect(info2.remaining).toBe(2);
  });

  it("reports allowed status correctly", () => {
    const options = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit("test-key", options);
    const info = getRateLimitInfo("test-key", options);
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
  it("allows burst then blocks", () => {
    const options = { maxRequests: 3, windowMs: 100 };

    // Burst: 3 requests should be allowed
    expect(checkRateLimit("burst", options).allowed).toBe(true);
    expect(checkRateLimit("burst", options).allowed).toBe(true);
    expect(checkRateLimit("burst", options).allowed).toBe(true);

    // 4th should be blocked
    expect(checkRateLimit("burst", options).allowed).toBe(false);
  });
});
