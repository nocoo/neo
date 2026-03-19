import { describe, it, expect, vi } from "vitest";
import { isD1Configured } from "@/lib/db/d1-client";

// We can't test executeD1Query without mocking fetch,
// but we can test isD1Configured and the credential validation.

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
