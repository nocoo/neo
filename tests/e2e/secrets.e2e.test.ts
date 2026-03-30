/**
 * API E2E tests — Secret CRUD via real HTTP requests.
 *
 * Requires: bun run scripts/run-e2e.ts (auto-starts dev server)
 * Zero vi.mock — all requests go through Next.js HTTP stack.
 */

import { describe, it, expect, beforeEach } from "bun:test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17026";
const SECRETS_URL = `${BASE}/api/e2e/secrets`;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createSecret(data: Record<string, unknown>) {
  const res = await fetch(SECRETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function getSecrets() {
  const res = await fetch(SECRETS_URL);
  return res.json();
}

async function getSecretById(id: string) {
  const res = await fetch(`${SECRETS_URL}?id=${id}`);
  return res.json();
}

async function getSecretCount() {
  const res = await fetch(`${SECRETS_URL}?count=true`);
  return res.json();
}

async function updateSecret(data: Record<string, unknown>) {
  const res = await fetch(SECRETS_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function deleteSecret(id: string) {
  const res = await fetch(`${SECRETS_URL}?id=${id}`, { method: "DELETE" });
  return res.json();
}

async function batchImport(entries: Record<string, unknown>[]) {
  const res = await fetch(SECRETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entries),
  });
  return res.json();
}

// ── Cleanup helper ───────────────────────────────────────────────────────────

async function deleteAllSecrets() {
  const list = await getSecrets();
  if (list.success && Array.isArray(list.data)) {
    for (const s of list.data) {
      await deleteSecret(s.id);
    }
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("Secret CRUD — HTTP E2E", () => {
  beforeEach(async () => {
    await deleteAllSecrets();
  });

  // ── Create ─────────────────────────────────────────────────────────────

  describe("createSecret", () => {
    it("creates a secret with defaults", async () => {
      const result = await createSecret({
        name: "GitHub",
        secret: "JBSWY3DPEHPK3PXP",
      });

      expect(result.success).toBe(true);
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

      expect(result.success).toBe(true);
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

      expect(result.success).toBe(true);
      expect(result.data.secret).toBe("JBSWY3DPEHPK3PXP");
    });

    it("trims name whitespace", async () => {
      const result = await createSecret({
        name: "  GitHub  ",
        secret: "JBSWY3DPEHPK3PXP",
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("GitHub");
    });

    it("rejects empty name", async () => {
      const result = await createSecret({
        name: "",
        secret: "JBSWY3DPEHPK3PXP",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Name is required");
    });

    it("rejects invalid base32 secret", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "not-valid-base32!!!",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid secret");
    });

    it("rejects invalid OTP type", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        type: "steam",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unsupported OTP type");
    });

    it("rejects invalid digit count", async () => {
      const result = await createSecret({
        name: "Test",
        secret: "JBSWY3DPEHPK3PXP",
        digits: 7,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid digit count");
    });

    it("generates unique IDs", async () => {
      const r1 = await createSecret({ name: "First", secret: "JBSWY3DPEHPK3PXP" });
      const r2 = await createSecret({ name: "Second", secret: "JBSWY3DPEHPK3PXP" });

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(r1.data.id).not.toBe(r2.data.id);
    });
  });

  // ── Read ───────────────────────────────────────────────────────────────

  describe("getSecrets", () => {
    it("returns empty list initially", async () => {
      const result = await getSecrets();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns created secrets", async () => {
      await createSecret({ name: "A", secret: "JBSWY3DPEHPK3PXP" });
      await createSecret({ name: "B", secret: "JBSWY3DPEHPK3PXP" });

      const result = await getSecrets();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getSecretById", () => {
    it("returns a specific secret", async () => {
      const created = await createSecret({ name: "Target", secret: "JBSWY3DPEHPK3PXP" });
      expect(created.success).toBe(true);

      const result = await getSecretById(created.data.id);
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Target");
    });

    it("returns error for non-existent id", async () => {
      const result = await getSecretById("nonexistent");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("getSecretCount", () => {
    it("returns 0 initially", async () => {
      const result = await getSecretCount();
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it("returns correct count after creates", async () => {
      await createSecret({ name: "A", secret: "JBSWY3DPEHPK3PXP" });
      await createSecret({ name: "B", secret: "JBSWY3DPEHPK3PXP" });

      const result = await getSecretCount();
      expect(result.success).toBe(true);
      expect(result.data).toBe(2);
    });
  });

  // ── Update ─────────────────────────────────────────────────────────────

  describe("updateSecret", () => {
    it("updates name", async () => {
      const created = await createSecret({ name: "Old", secret: "JBSWY3DPEHPK3PXP" });
      expect(created.success).toBe(true);

      const result = await updateSecret({ id: created.data.id, name: "New" });
      expect(result.success).toBe(true);
      expect(result.data.name).toBe("New");
    });

    it("updates multiple fields", async () => {
      const created = await createSecret({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
      expect(created.success).toBe(true);

      const result = await updateSecret({
        id: created.data.id,
        name: "Updated",
        account: "new@account.com",
        digits: 8,
      });

      expect(result.success).toBe(true);
      expect(result.data.name).toBe("Updated");
      expect(result.data.account).toBe("new@account.com");
      expect(result.data.digits).toBe(8);
    });

    it("rejects non-existent id", async () => {
      const result = await updateSecret({ id: "nonexistent", name: "Nothing" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  // ── Delete ─────────────────────────────────────────────────────────────

  describe("deleteSecret", () => {
    it("deletes a secret", async () => {
      const created = await createSecret({ name: "ToDelete", secret: "JBSWY3DPEHPK3PXP" });
      expect(created.success).toBe(true);

      const result = await deleteSecret(created.data.id);
      expect(result.success).toBe(true);

      const count = await getSecretCount();
      expect(count.data).toBe(0);
    });
  });

  // ── Batch import ───────────────────────────────────────────────────────

  describe("batchImportSecrets", () => {
    it("imports multiple secrets", async () => {
      const result = await batchImport([
        { name: "A", secret: "JBSWY3DPEHPK3PXP" },
        { name: "B", secret: "GEZDGNBVGY3TQOJQ" },
      ]);

      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(2);
      expect(result.data.skipped).toBe(0);
    });

    it("skips invalid entries", async () => {
      const result = await batchImport([
        { name: "Good", secret: "JBSWY3DPEHPK3PXP" },
        { name: "", secret: "JBSWY3DPEHPK3PXP" },
        { name: "Bad", secret: "invalid!!!" },
      ]);

      expect(result.success).toBe(true);
      expect(result.data.imported).toBe(1);
      expect(result.data.skipped).toBe(2);
    });

    it("rejects empty array", async () => {
      const result = await batchImport([]);
      expect(result.success).toBe(false);
      expect(result.error).toContain("No secrets");
    });
  });
});
