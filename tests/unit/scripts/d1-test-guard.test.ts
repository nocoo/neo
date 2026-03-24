import { describe, it, expect, vi, afterEach } from "vitest";
import { validateAndOverride } from "@/scripts/d1-test-guard";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_ENV = {
  CLOUDFLARE_ACCOUNT_ID: "acc-123",
  CLOUDFLARE_API_TOKEN: "tok-456",
  CLOUDFLARE_D1_DATABASE_ID: "prod-db-id",
  CLOUDFLARE_D1_TEST_DATABASE_ID: "test-db-id",
};

function mockFetchSuccess() {
  return vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        success: true,
        result: [{ results: [{ value: "test" }] }],
      }),
      { status: 200 },
    ),
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("d1-test-guard", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Layer 1: Existence ──────────────────────────────────────────────────

  describe("Layer 1: existence", () => {
    it("throws when CLOUDFLARE_ACCOUNT_ID is missing", async () => {
      const env = { ...VALID_ENV, CLOUDFLARE_ACCOUNT_ID: undefined };
      await expect(validateAndOverride(env)).rejects.toThrow(
        "CLOUDFLARE_ACCOUNT_ID not set",
      );
    });

    it("throws when CLOUDFLARE_API_TOKEN is missing", async () => {
      const env = { ...VALID_ENV, CLOUDFLARE_API_TOKEN: undefined };
      await expect(validateAndOverride(env)).rejects.toThrow(
        "CLOUDFLARE_API_TOKEN not set",
      );
    });

    it("throws when CLOUDFLARE_D1_DATABASE_ID is missing", async () => {
      const env = { ...VALID_ENV, CLOUDFLARE_D1_DATABASE_ID: undefined };
      await expect(validateAndOverride(env)).rejects.toThrow(
        "CLOUDFLARE_D1_DATABASE_ID not set",
      );
    });

    it("throws when CLOUDFLARE_D1_TEST_DATABASE_ID is missing", async () => {
      const env = { ...VALID_ENV, CLOUDFLARE_D1_TEST_DATABASE_ID: undefined };
      await expect(validateAndOverride(env)).rejects.toThrow(
        "CLOUDFLARE_D1_TEST_DATABASE_ID not set",
      );
    });

    it("reports all missing vars in a single error", async () => {
      const env = {
        CLOUDFLARE_ACCOUNT_ID: undefined,
        CLOUDFLARE_API_TOKEN: undefined,
        CLOUDFLARE_D1_DATABASE_ID: undefined,
        CLOUDFLARE_D1_TEST_DATABASE_ID: undefined,
      };
      await expect(validateAndOverride(env)).rejects.toThrow(
        /CLOUDFLARE_ACCOUNT_ID[\s\S]*CLOUDFLARE_API_TOKEN/,
      );
    });
  });

  // ── Layer 2: DB non-equality ────────────────────────────────────────────

  describe("Layer 2: DB non-equality", () => {
    it("throws when test DB ID === prod DB ID", async () => {
      const env = {
        ...VALID_ENV,
        CLOUDFLARE_D1_TEST_DATABASE_ID: "prod-db-id",
      };
      await expect(validateAndOverride(env)).rejects.toThrow(
        "FATAL: test DB ID === prod DB ID",
      );
    });
  });

  // ── Layer 3: Marker check ──────────────────────────────────────────────

  describe("Layer 3: marker check", () => {
    it("passes when marker returns env=test", async () => {
      globalThis.fetch = mockFetchSuccess();
      const result = await validateAndOverride(VALID_ENV);
      expect(result.env.CLOUDFLARE_D1_DATABASE_ID).toBe("test-db-id");
      expect(result.testDbId).toBe("test-db-id");
      expect(result.prodDbId).toBe("prod-db-id");
    });

    it("throws when D1 API returns non-ok", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("error", { status: 500 }),
      );
      await expect(validateAndOverride(VALID_ENV)).rejects.toThrow(
        "D1 API returned HTTP 500",
      );
    });

    it("throws when D1 API returns success=false", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      );
      await expect(validateAndOverride(VALID_ENV)).rejects.toThrow(
        "D1 API query unsuccessful",
      );
    });

    it("throws when marker value is not 'test'", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: true,
            result: [{ results: [{ value: "production" }] }],
          }),
          { status: 200 },
        ),
      );
      await expect(validateAndOverride(VALID_ENV)).rejects.toThrow(
        '_test_marker.value = "production"',
      );
    });

    it("throws when marker table is empty", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, result: [{ results: [] }] }),
          { status: 200 },
        ),
      );
      await expect(validateAndOverride(VALID_ENV)).rejects.toThrow(
        "_test_marker.value = undefined",
      );
    });

    it("throws when fetch fails (network error)", async () => {
      globalThis.fetch = vi
        .fn()
        .mockRejectedValue(new Error("Network unreachable"));
      await expect(validateAndOverride(VALID_ENV)).rejects.toThrow(
        "cannot reach D1 API",
      );
    });
  });

  // ── Overridden env ─────────────────────────────────────────────────────

  describe("overridden env", () => {
    it("replaces CLOUDFLARE_D1_DATABASE_ID with test DB ID", async () => {
      globalThis.fetch = mockFetchSuccess();
      const result = await validateAndOverride({
        ...VALID_ENV,
        EXTRA_VAR: "kept",
      });
      expect(result.env.CLOUDFLARE_D1_DATABASE_ID).toBe("test-db-id");
      expect(result.env.EXTRA_VAR).toBe("kept");
    });

    it("strips undefined values from overridden env", async () => {
      globalThis.fetch = mockFetchSuccess();
      const result = await validateAndOverride({
        ...VALID_ENV,
        SOME_UNDEFINED: undefined,
      });
      expect("SOME_UNDEFINED" in result.env).toBe(false);
    });
  });
});
