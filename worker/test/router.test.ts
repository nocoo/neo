/**
 * Router tests.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { handleRequest } from "../src/router";
import { clearAllRateLimits } from "../src/rate-limit";
import type { Env } from "../src/types";

// ── D1 mock ──────────────────────────────────────────────────────────────────

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
              if (sql.includes("DELETE FROM rate_limits")) {
                const count = rows.length;
                rows = [];
                return { meta: { changes: count } };
              }
              return { meta: { changes: 0 } };
            },
          };
        },
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

let mockDB: D1Database;
let mockEnv: Env;

function makeRequest(
  path: string,
  options: { method?: string; body?: unknown; host?: string } = {}
): Request {
  const { method = "GET", body, host = "localhost:8787" } = options;
  const init: RequestInit = {
    method,
    headers: { host, "Content-Type": "application/json" },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  return new Request(`http://${host}${path}`, init);
}

beforeEach(async () => {
  mockDB = createMockD1();
  mockEnv = { DB: mockDB } as Env;
  await clearAllRateLimits(mockDB);
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe("handleRequest", () => {
  it("routes POST /otp to OTP handler", async () => {
    const req = makeRequest("/otp", {
      method: "POST",
      body: { secret: "JBSWY3DPEHPK3PXP", format: "json" },
    });
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.otp).toBeDefined();
  });

  it("returns 400 for invalid JSON body on POST /otp", async () => {
    const req = new Request("http://localhost:8787/otp", {
      method: "POST",
      headers: { host: "localhost:8787", "Content-Type": "application/json" },
      body: "not valid json",
    });
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(400);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 404 for GET /otp/:secret (deprecated path)", async () => {
    const req = makeRequest("/otp/JBSWY3DPEHPK3PXP");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(404);
  });

  it("returns 404 for unknown paths", async () => {
    const req = makeRequest("/unknown");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(404);
  });

  it("handles health check", async () => {
    const req = makeRequest("/health");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(200);
    const data = (await res.json()) as Record<string, unknown>;
    expect(data.status).toBe("ok");
  });

  it("handles OPTIONS preflight", async () => {
    const req = new Request("http://localhost:8787/otp", {
      method: "OPTIONS",
      headers: {
        host: "localhost:8787",
        origin: "http://localhost:3000",
      },
    });
    const res = await handleRequest(req, mockEnv);
    // localhost cross-port is allowed
    expect(res.status).toBe(204);
  });

  it("includes security headers in responses", async () => {
    const req = makeRequest("/health");
    const res = await handleRequest(req, mockEnv);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 400 for invalid OTP secret", async () => {
    const req = makeRequest("/otp", {
      method: "POST",
      body: { secret: "INVALID!@#" },
    });
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(400);
  });

  it("rate limits excessive requests", async () => {
    // OTP preset allows 60 per minute — send 61
    for (let i = 0; i < 60; i++) {
      const req = makeRequest("/otp", {
        method: "POST",
        body: { secret: "JBSWY3DPEHPK3PXP", format: "json" },
      });
      await handleRequest(req, mockEnv);
    }
    const req = makeRequest("/otp", {
      method: "POST",
      body: { secret: "JBSWY3DPEHPK3PXP", format: "json" },
    });
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(429);
  });
});
