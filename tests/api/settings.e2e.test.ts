/**
 * API E2E tests — Auth, Settings, and Dashboard.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockScopedDB, resetStorage, TEST_USER_ID } from "./setup";

// ── Top-level mock (authenticated) ──────────────────────────────────────

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

import { getUserSettings, updateUserSettings } from "@/actions/settings";
import { getDashboardData } from "@/actions/dashboard";
import { createSecret } from "@/actions/secrets";
import { createManualBackup } from "@/actions/backup";

// ── Reset ────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStorage();
});

// ── Settings tests ───────────────────────────────────────────────────────

describe("Settings — API E2E", () => {
  describe("getUserSettings", () => {
    it("returns null for new user", async () => {
      const result = await getUserSettings();
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns settings after creation", async () => {
      await updateUserSettings({ theme: "dark" });
      const result = await getUserSettings();
      expect(result.success).toBe(true);
      expect(result.data!.theme).toBe("dark");
    });
  });

  describe("updateUserSettings", () => {
    it("creates settings with defaults", async () => {
      const result = await updateUserSettings({ theme: "dark" });
      expect(result.success).toBe(true);
      expect(result.data!.theme).toBe("dark");
      expect(result.data!.language).toBe("en");
      expect(result.data!.encryptionKeyHash).toBeNull();
    });

    it("updates theme", async () => {
      await updateUserSettings({ theme: "light" });
      const result = await updateUserSettings({ theme: "dark" });
      expect(result.success).toBe(true);
      expect(result.data!.theme).toBe("dark");
    });

    it("updates language", async () => {
      await updateUserSettings({ language: "en" });
      const result = await updateUserSettings({ language: "zh" });
      expect(result.success).toBe(true);
      expect(result.data!.language).toBe("zh");
    });

    it("updates encryption key hash", async () => {
      const result = await updateUserSettings({
        encryptionKeyHash: "abc123hash",
      });
      expect(result.success).toBe(true);
      expect(result.data!.encryptionKeyHash).toBe("abc123hash");
    });

    it("clears encryption key hash", async () => {
      await updateUserSettings({ encryptionKeyHash: "abc123hash" });
      const result = await updateUserSettings({ encryptionKeyHash: null });
      expect(result.success).toBe(true);
      expect(result.data!.encryptionKeyHash).toBeNull();
    });

    it("rejects invalid theme", async () => {
      const result = await updateUserSettings({ theme: "neon" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid theme");
    });

    it("rejects invalid language", async () => {
      const result = await updateUserSettings({ language: "fr" });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid language");
    });

    it("validates theme values", async () => {
      for (const theme of ["light", "dark", "system"]) {
        const result = await updateUserSettings({ theme });
        expect(result.success).toBe(true);
      }
    });

    it("validates language values", async () => {
      for (const language of ["en", "zh"]) {
        const result = await updateUserSettings({ language });
        expect(result.success).toBe(true);
      }
    });
  });
});

// ── Dashboard aggregate tests ────────────────────────────────────────────

describe("Dashboard — API E2E", () => {
  it("returns empty dashboard for new user", async () => {
    const result = await getDashboardData();
    expect(result.success).toBe(true);
    expect(result.data!.secrets).toEqual([]);
    expect(result.data!.backupCount).toBe(0);
    expect(result.data!.lastBackupAt).toBeNull();
    expect(result.data!.encryptionEnabled).toBe(false);
  });

  it("aggregates secrets count", async () => {
    await createSecret({ name: "A", secret: "JBSWY3DPEHPK3PXP" });
    await createSecret({ name: "B", secret: "GEZDGNBVGY3TQOJQ" });

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    expect(result.data!.secrets).toHaveLength(2);
  });

  it("aggregates backup count", async () => {
    await createManualBackup(JSON.stringify([{ name: "Test" }]));

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    expect(result.data!.backupCount).toBe(1);
    expect(result.data!.lastBackupAt).toBeTruthy();
  });

  it("detects encryption enabled", async () => {
    await updateUserSettings({ encryptionKeyHash: "someHash" });

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    expect(result.data!.encryptionEnabled).toBe(true);
  });

  it("detects encryption disabled", async () => {
    await updateUserSettings({ encryptionKeyHash: null });

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    expect(result.data!.encryptionEnabled).toBe(false);
  });
});
