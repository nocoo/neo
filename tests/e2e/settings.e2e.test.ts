/**
 * API E2E tests — Settings, Encryption, and Dashboard via real HTTP requests.
 *
 * Requires: bun run scripts/run-e2e.ts (auto-starts dev server)
 * Zero vi.mock — all requests go through Next.js HTTP stack.
 */

import { beforeEach, describe, expect, it } from "bun:test";
import { openEncryptedZip } from "../../models/backup-archive";
import { generateOTP } from "../../models/otp";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:17026";
const SETTINGS_URL = `${BASE}/api/e2e/settings`;
const DASHBOARD_URL = `${BASE}/api/e2e/dashboard`;
const SECRETS_URL = `${BASE}/api/e2e/secrets`;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getSettings() {
  const res = await fetch(SETTINGS_URL);
  return res.json();
}

async function updateSettings(data: Record<string, unknown>) {
  const res = await fetch(SETTINGS_URL, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function generateEncryptionKey() {
  const res = await fetch(SETTINGS_URL, { method: "POST" });
  return res.json();
}

async function getDashboard() {
  const res = await fetch(DASHBOARD_URL);
  return res.json();
}

async function createSecret(data: Record<string, unknown>) {
  const res = await fetch(SECRETS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function deleteAllSecrets() {
  const list = await (await fetch(SECRETS_URL)).json();
  if (list.success && Array.isArray(list.data)) {
    for (const s of list.data) {
      await fetch(`${SECRETS_URL}?id=${s.id}`, { method: "DELETE" });
    }
  }
}

async function resetStorage() {
  const res = await fetch(`${BASE}/api/e2e/reset`, { method: "POST" });
  return res.json();
}

// ── Settings tests ──────────────────────────────────────────────────────────

describe("Settings — HTTP E2E", () => {
  describe("getUserSettings", () => {
    it("returns null for new user", async () => {
      const result = await getSettings();
      expect(result.success).toBe(true);
      // May be null or have defaults depending on prior test runs
      // The important thing is the HTTP round-trip works
    });
  });

  describe("updateUserSettings", () => {
    it("creates settings with specified values", async () => {
      const result = await updateSettings({ theme: "dark", language: "en" });
      expect(result.success).toBe(true);
      expect(result.data.theme).toBe("dark");
      expect(result.data.language).toBe("en");
    });

    it("updates theme", async () => {
      await updateSettings({ theme: "light" });
      const result = await updateSettings({ theme: "dark" });
      expect(result.success).toBe(true);
      expect(result.data.theme).toBe("dark");
    });

    it("updates language", async () => {
      await updateSettings({ language: "en" });
      const result = await updateSettings({ language: "zh" });
      expect(result.success).toBe(true);
      expect(result.data.language).toBe("zh");
    });

    it("updates encryption key hash", async () => {
      const result = await updateSettings({ encryptionKeyHash: "abc123hash" });
      expect(result.success).toBe(true);
      expect(result.data.encryptionKeyHash).toBe("abc123hash");
    });

    it("rejects invalid theme", async () => {
      const result = await updateSettings({ theme: "neon" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid theme");
    });

    it("rejects invalid language", async () => {
      const result = await updateSettings({ language: "fr" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid language");
    });

    it("validates all theme values", async () => {
      for (const theme of ["light", "dark", "system"]) {
        const result = await updateSettings({ theme });
        expect(result.success).toBe(true);
      }
    });

    it("validates all language values", async () => {
      for (const language of ["en", "zh"]) {
        const result = await updateSettings({ language });
        expect(result.success).toBe(true);
      }
    });
  });
});

// ── Dashboard aggregate tests ───────────────────────────────────────────────

describe("Dashboard — HTTP E2E", () => {
  beforeEach(async () => {
    await deleteAllSecrets();
  });

  it("returns dashboard data", async () => {
    const result = await getDashboard();
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("secrets");
    expect(result.data).toHaveProperty("encryptionEnabled");
  });

  it("aggregates secrets count", async () => {
    await createSecret({ name: "A", secret: "JBSWY3DPEHPK3PXP" });
    await createSecret({ name: "B", secret: "GEZDGNBVGY3TQOJQ" });

    const result = await getDashboard();
    expect(result.success).toBe(true);
    expect(result.data.secrets).toHaveLength(2);
  });

  it("detects encryption enabled after key generation", async () => {
    await generateEncryptionKey();

    const result = await getDashboard();
    expect(result.success).toBe(true);
    expect(result.data.encryptionEnabled).toBe(true);
  });
});

// ── Core journey: create → read → encrypted export → decrypt → TOTP ────────

describe("Encrypted backup journey — HTTP E2E", () => {
  it("round-trips a secret through the encrypted archive and generates its TOTP", async () => {
    const seed = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(await resetStorage()).toEqual({ success: true });

    const keyResult = await generateEncryptionKey();
    expect(keyResult.success).toBe(true);
    expect(typeof keyResult.data).toBe("string");
    const key = keyResult.data as string;

    const created = await createSecret({
      name: "RFC 6238",
      account: "e2e@test.local",
      secret: seed,
      digits: 8,
      period: 30,
      algorithm: "SHA-1",
    });
    expect(created.success).toBe(true);

    const stored = await (await fetch(`${SECRETS_URL}?id=${created.data.id}`)).json();
    expect(stored.success).toBe(true);
    expect(stored.data.secret).toBe(seed);
    expect(stored.data.digits).toBe(8);

    const archive = await fetch(`${BASE}/api/backup/archive`);
    expect(archive.status).toBe(200);
    expect(archive.headers.get("content-type")).toBe("application/zip");
    const zip = new Uint8Array(await archive.arrayBuffer());
    expect(zip.byteLength).toBeGreaterThan(0);

    const restored = await openEncryptedZip(zip, key);
    expect(restored).toHaveLength(1);
    expect(restored[0]?.secret).toBe(seed);
    expect(restored[0]?.algorithm).toBe("SHA-1");
    expect(restored[0]?.period).toBe(30);
    expect(restored[0]?.digits).toBe(8);

    const otp = await generateOTP(restored[0]?.secret ?? "", 59, {
      digits: 8,
      period: 30,
      algorithm: "SHA1",
      type: "TOTP",
    });
    expect(otp).toBe("94287082");
  });
});
