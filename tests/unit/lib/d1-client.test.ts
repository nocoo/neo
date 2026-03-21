/**
 * D1 HTTP client tests — isD1Configured + executeD1Query.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isD1Configured, executeD1Query } from "@/lib/db/d1-client";

describe("isD1Configured", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("returns false when no env vars are set", () => {
    process.env = { ...originalEnv };
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_D1_DATABASE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(isD1Configured()).toBe(false);
  });

  it("returns false when only some env vars are set", () => {
    process.env = {
      ...originalEnv,
      CLOUDFLARE_ACCOUNT_ID: "abc",
    };
    delete process.env.CLOUDFLARE_D1_DATABASE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    expect(isD1Configured()).toBe(false);
  });

  it("returns true when all env vars are set", () => {
    process.env = {
      ...originalEnv,
      CLOUDFLARE_ACCOUNT_ID: "abc",
      CLOUDFLARE_D1_DATABASE_ID: "def",
      CLOUDFLARE_API_TOKEN: "ghi",
    };
    expect(isD1Configured()).toBe(true);
  });
});

describe("executeD1Query", () => {
  const originalEnv = process.env;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    process.env = {
      ...originalEnv,
      CLOUDFLARE_ACCOUNT_ID: "acc-123",
      CLOUDFLARE_D1_DATABASE_ID: "db-456",
      CLOUDFLARE_API_TOKEN: "token-789",
    };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws when credentials are missing", async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    await expect(executeD1Query("SELECT 1")).rejects.toThrow(
      "D1 credentials not configured"
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("sends correct request to Cloudflare D1 API", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          result: [{ results: [{ id: 1 }], success: true, meta: {} }],
          errors: [],
        }),
    });

    const results = await executeD1Query("SELECT * FROM t WHERE id = ?", [1]);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.cloudflare.com/client/v4/accounts/acc-123/d1/database/db-456/query",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ sql: "SELECT * FROM t WHERE id = ?", params: [1] }),
      })
    );
    expect(results).toEqual([{ id: 1 }]);
  });

  it("returns empty array when no results", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          result: [{ results: [], success: true, meta: {} }],
          errors: [],
        }),
    });

    const results = await executeD1Query("SELECT * FROM t WHERE 1=0");
    expect(results).toEqual([]);
  });

  it("returns empty array when result array is empty", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          result: [],
          errors: [],
        }),
    });

    const results = await executeD1Query("SELECT * FROM t");
    expect(results).toEqual([]);
  });

  it("throws on HTTP error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(executeD1Query("SELECT 1")).rejects.toThrow("D1 query failed");
  });

  it("throws UNIQUE constraint error on HTTP error with unique keyword", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("UNIQUE constraint failed: users.email"),
    });

    await expect(executeD1Query("INSERT INTO users ...")).rejects.toThrow(
      "UNIQUE constraint failed"
    );
  });

  it("throws on data.success === false", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          result: [],
          errors: [{ message: "syntax error" }],
        }),
    });

    await expect(executeD1Query("INVALID SQL")).rejects.toThrow("D1 query failed");
  });

  it("throws UNIQUE constraint error from data.errors", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: false,
          result: [],
          errors: [{ message: "UNIQUE constraint failed: secrets.id" }],
        }),
    });

    await expect(executeD1Query("INSERT INTO secrets ...")).rejects.toThrow(
      "UNIQUE constraint failed"
    );
  });

  it("uses default empty params array", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          result: [{ results: [], success: true, meta: {} }],
          errors: [],
        }),
    });

    await executeD1Query("SELECT 1");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ sql: "SELECT 1", params: [] }),
      })
    );
  });
});
