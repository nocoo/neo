/**
 * API E2E tests — Secret CRUD.
 *
 * Tests Server Actions end-to-end with in-memory mock storage.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockScopedDB,
  resetStorage,
  TEST_USER_ID,
  assertSuccess,
  assertError,
} from "./setup";

// ── Top-level mock ───────────────────────────────────────────────────────

vi.mock("@/lib/auth-context", () => ({
  getScopedDB: vi.fn().mockImplementation(async () => createMockScopedDB()),
  getSession: vi.fn().mockResolvedValue({
    user: { id: TEST_USER_ID, name: "E2E User", email: "e2e@test.local" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }),
  getAuthContext: vi.fn().mockImplementation(async () => ({
    db: createMockScopedDB(),
    userId: TEST_USER_ID,
  })),
  requireAuth: vi.fn().mockResolvedValue(TEST_USER_ID),
}));

import {
  getSecrets,
  getSecretById,
  createSecret,
  updateSecret,
  deleteSecret,
  getSecretCount,
  batchImportSecrets,
} from "@/actions/secrets";

// ── Reset storage between tests ──────────────────────────────────────────

beforeEach(() => {
  resetStorage();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("Secret CRUD — API E2E", () => {
  // ── Create ───────────────────────────────────────────────────────────

  describe("createSecret", () => {
    it("creates a secret with defaults", async () => {
      const result = await createSecret({
        name: "GitHub",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(result);
      expect(result.data.name).toBe("GitHub");
      expect(result.data.secret).toBe("JBSWY3DPEHPK3PXP");
      expect(result.data.type).toBe("totp");
      expect(result.data.digits).toBe(6);
      expect(result.data.period).toBe(30);
      expect(result.data.algorithm).toBe("SHA-1");
    });

    it("creates a secret with custom params", async () => {
      const result = await createSecret({
        name: "AWS",
        secret: "JBSWY3DPEHPK3PXP",
        account: "admin@aws.com",
        type: "totp",
        digits: 8,
        period: 60,
        algorithm: "SHA-256",
      });

      assertSuccess(result);
      expect(result.data.digits).toBe(8);
      expect(result.data.period).toBe(60);
      expect(result.data.algorithm).toBe("SHA-256");
      expect(result.data.account).toBe("admin@aws.com");
    });

    it("normalizes secret to uppercase", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "jbswy3dpehpk3pxp",
      });

      assertSuccess(result);
      expect(result.data.secret).toBe("JBSWY3DPEHPK3PXP");
    });

    it("trims name whitespace", async () => {
      const result = await createSecret({
        name: "  GitHub  ",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(result);
      expect(result.data.name).toBe("GitHub");
    });

    it("rejects empty name", async () => {
      const result = await createSecret({
        name: "",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertError(result);
      expect(result.error).toContain("Name is required");
    });

    it("rejects whitespace-only name", async () => {
      const result = await createSecret({
        name: "   ",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertError(result);
      expect(result.error).toContain("Name is required");
    });

    it("rejects invalid base32 secret", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "not-valid-base32!!!",
      });

      assertError(result);
      expect(result.error).toContain("Invalid secret");
    });

    it("rejects empty secret", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "",
      });

      assertError(result);
      expect(result.error).toContain("Invalid secret");
    });

    it("rejects invalid OTP type", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        type: "steam" as never,
      });

      assertError(result);
      expect(result.error).toContain("Unsupported OTP type");
    });

    it("rejects invalid digit count", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        digits: 7,
      });

      assertError(result);
      expect(result.error).toContain("Invalid digit count");
    });

    it("rejects invalid period", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        period: 45,
      });

      assertError(result);
      expect(result.error).toContain("Invalid TOTP period");
    });

    it("rejects invalid algorithm", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        algorithm: "MD5" as never,
      });

      assertError(result);
      expect(result.error).toContain("Unsupported algorithm");
    });

    it("accepts valid SHA-1 hyphenated algorithm", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        algorithm: "SHA-1",
      });

      assertSuccess(result);
    });

    it("generates unique IDs", async () => {
      const r1 = await createSecret({
        name: "First",
        secret: "JBSWY3DPEHPK3PXP",
      });
      const r2 = await createSecret({
        name: "Second",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(r1);
      assertSuccess(r2);
      expect(r1.data.id).not.toBe(r2.data.id);
    });
  });

  // ── Read ─────────────────────────────────────────────────────────────

  describe("getSecrets", () => {
    it("returns empty list initially", async () => {
      const result = await getSecrets();
      assertSuccess(result);
      expect(result.data).toEqual([]);
    });

    it("returns created secrets", async () => {
      await createSecret({ name: "A", secret: "JBSWY3DPEHPK3PXP" });
      await createSecret({ name: "B", secret: "JBSWY3DPEHPK3PXP" });

      const result = await getSecrets();
      assertSuccess(result);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getSecretById", () => {
    it("returns a specific secret", async () => {
      const created = await createSecret({
        name: "Target",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(created);
      const result = await getSecretById(created.data.id);
      assertSuccess(result);
      expect(result.data.name).toBe("Target");
    });

    it("returns error for non-existent id", async () => {
      const result = await getSecretById("nonexistent");
      assertError(result);
      expect(result.error).toContain("not found");
    });

    it("rejects empty id", async () => {
      const result = await getSecretById("");
      assertError(result);
      expect(result.error).toContain("required");
    });
  });

  describe("getSecretCount", () => {
    it("returns 0 initially", async () => {
      const result = await getSecretCount();
      assertSuccess(result);
      expect(result.data).toBe(0);
    });

    it("returns correct count after creates", async () => {
      await createSecret({ name: "A", secret: "JBSWY3DPEHPK3PXP" });
      await createSecret({ name: "B", secret: "JBSWY3DPEHPK3PXP" });
      await createSecret({ name: "C", secret: "JBSWY3DPEHPK3PXP" });

      const result = await getSecretCount();
      assertSuccess(result);
      expect(result.data).toBe(3);
    });
  });

  // ── Update ───────────────────────────────────────────────────────────

  describe("updateSecret", () => {
    it("updates name", async () => {
      const created = await createSecret({
        name: "Old",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(created);
      const result = await updateSecret({
        id: created.data.id,
        name: "New",
      });

      assertSuccess(result);
      expect(result.data.name).toBe("New");
    });

    it("updates multiple fields", async () => {
      const created = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(created);
      const result = await updateSecret({
        id: created.data.id,
        name: "Updated",
        account: "new@account.com",
        digits: 8,
      });

      assertSuccess(result);
      expect(result.data.name).toBe("Updated");
      expect(result.data.account).toBe("new@account.com");
      expect(result.data.digits).toBe(8);
    });

    it("rejects non-existent id", async () => {
      const result = await updateSecret({
        id: "nonexistent",
        name: "Nothing",
      });

      assertError(result);
      expect(result.error).toContain("not found");
    });

    it("rejects empty id", async () => {
      const result = await updateSecret({ id: "", name: "Nothing" });
      assertError(result);
      expect(result.error).toContain("required");
    });

    it("validates secret on update", async () => {
      const created = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(created);
      const result = await updateSecret({
        id: created.data.id,
        secret: "invalid!!!",
      });

      assertError(result);
      expect(result.error).toContain("Invalid secret");
    });

    it("rejects invalid OTP params on update", async () => {
      const created = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(created);
      const result = await updateSecret({
        id: created.data.id,
        digits: 7,
      });

      assertError(result);
      expect(result.error).toContain("Invalid digit count");
    });
  });

  // ── Delete ───────────────────────────────────────────────────────────

  describe("deleteSecret", () => {
    it("deletes a secret", async () => {
      const created = await createSecret({
        name: "ToDelete",
        secret: "JBSWY3DPEHPK3PXP",
      });

      assertSuccess(created);
      const result = await deleteSecret(created.data.id);
      assertSuccess(result);

      const count = await getSecretCount();
      assertSuccess(count);
      expect(count.data).toBe(0);
    });

    it("rejects empty id", async () => {
      const result = await deleteSecret("");
      assertError(result);
      expect(result.error).toContain("required");
    });
  });

  // ── Batch import ─────────────────────────────────────────────────────

  describe("batchImportSecrets", () => {
    it("imports multiple secrets", async () => {
      const result = await batchImportSecrets([
        { name: "A", secret: "JBSWY3DPEHPK3PXP" },
        { name: "B", secret: "GEZDGNBVGY3TQOJQ" },
      ]);

      assertSuccess(result);
      expect(result.data.imported).toBe(2);
      expect(result.data.skipped).toBe(0);
    });

    it("skips invalid entries", async () => {
      const result = await batchImportSecrets([
        { name: "Good", secret: "JBSWY3DPEHPK3PXP" },
        { name: "", secret: "JBSWY3DPEHPK3PXP" },
        { name: "Bad", secret: "invalid!!!" },
      ]);

      assertSuccess(result);
      expect(result.data.imported).toBe(1);
      expect(result.data.skipped).toBe(2);
    });

    it("rejects empty array", async () => {
      const result = await batchImportSecrets([]);
      assertError(result);
      expect(result.error).toContain("No secrets");
    });

    it("rejects more than 100 secrets", async () => {
      const tooMany = Array.from({ length: 101 }, (_, i) => ({
        name: `S${i}`,
        secret: "JBSWY3DPEHPK3PXP",
      }));

      const result = await batchImportSecrets(tooMany);
      assertError(result);
      expect(result.error).toContain("Maximum 100");
    });

    it("creates correct count after import", async () => {
      await batchImportSecrets([
        { name: "A", secret: "JBSWY3DPEHPK3PXP" },
        { name: "B", secret: "GEZDGNBVGY3TQOJQ" },
        { name: "C", secret: "GEZDGNBVGY3TQOJQ" },
      ]);

      // A, B, C all have different names — all should be imported
      const count = await getSecretCount();
      assertSuccess(count);
      expect(count.data).toBe(3);
    });

    it("skips within-batch duplicates (same name + secret)", async () => {
      const result = await batchImportSecrets([
        { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
        { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      ]);

      assertSuccess(result);
      expect(result.data.imported).toBe(1);
      expect(result.data.duplicates).toBe(1);
    });

    it("skips duplicates of existing secrets", async () => {
      // Create a secret first
      await createSecret({ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" });

      const result = await batchImportSecrets([
        { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
        { name: "AWS", secret: "GEZDGNBVGY3TQOJQ" },
      ]);

      assertSuccess(result);
      expect(result.data.imported).toBe(1);
      expect(result.data.duplicates).toBe(1);

      const count = await getSecretCount();
      assertSuccess(count);
      expect(count.data).toBe(2); // 1 original + 1 new
    });
  });
});
