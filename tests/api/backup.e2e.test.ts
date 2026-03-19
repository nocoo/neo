/**
 * API E2E tests — Backup operations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockScopedDB, resetStorage, TEST_USER_ID } from "./setup";

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
  getBackups,
  getLatestBackup,
  getBackupCount,
  createManualBackup,
  cleanupBackups,
  restoreBackup,
} from "@/actions/backup";

// ── Reset ────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetStorage();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("Backup operations — API E2E", () => {
  const sampleSecrets = JSON.stringify([
    { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
    { name: "AWS", secret: "GEZDGNBVGY3TQOJQ" },
  ]);

  // ── Create ───────────────────────────────────────────────────────────

  describe("createManualBackup", () => {
    it("creates a backup from secrets JSON", async () => {
      const result = await createManualBackup(sampleSecrets);

      expect(result.success).toBe(true);
      expect(result.data!.secretCount).toBe(2);
      expect(result.data!.reason).toBe("manual");
      expect(result.data!.encrypted).toBe(false);
      expect(result.data!.filename).toBeTruthy();
    });

    it("stores backup data", async () => {
      const result = await createManualBackup(sampleSecrets);
      expect(result.success).toBe(true);
      expect(result.data!.data).toBe(sampleSecrets);
    });

    it("generates hash", async () => {
      const result = await createManualBackup(sampleSecrets);
      expect(result.success).toBe(true);
      expect(result.data!.hash).toBeTruthy();
      expect(result.data!.hash.length).toBe(8);
    });

    it("rejects empty data", async () => {
      const result = await createManualBackup("");
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects invalid JSON", async () => {
      const result = await createManualBackup("not json");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid JSON");
    });

    it("rejects non-array JSON", async () => {
      const result = await createManualBackup('{"key": "value"}');
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid backup data");
    });
  });

  // ── Read ─────────────────────────────────────────────────────────────

  describe("getBackups", () => {
    it("returns empty list initially", async () => {
      const result = await getBackups();
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("returns created backups", async () => {
      await createManualBackup(sampleSecrets);
      await createManualBackup(JSON.stringify([{ name: "Test" }]));

      const result = await getBackups();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("getLatestBackup", () => {
    it("returns null when no backups", async () => {
      const result = await getLatestBackup();
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("returns the most recent backup", async () => {
      await createManualBackup(sampleSecrets);

      const result = await getLatestBackup();
      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data!.secretCount).toBe(2);
    });
  });

  describe("getBackupCount", () => {
    it("returns 0 initially", async () => {
      const result = await getBackupCount();
      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
    });

    it("returns correct count", async () => {
      await createManualBackup(sampleSecrets);
      await createManualBackup(sampleSecrets);
      await createManualBackup(sampleSecrets);

      const result = await getBackupCount();
      expect(result.success).toBe(true);
      expect(result.data).toBe(3);
    });
  });

  // ── Cleanup ──────────────────────────────────────────────────────────

  describe("cleanupBackups", () => {
    it("succeeds with no backups", async () => {
      const result = await cleanupBackups();
      expect(result.success).toBe(true);
      expect(result.data!.deleted).toBe(0);
    });

    it("succeeds when under retention limit", async () => {
      await createManualBackup(sampleSecrets);
      const result = await cleanupBackups();
      expect(result.success).toBe(true);
    });

    it("returns correct deleted count when over limit", async () => {
      // Create 5 backups, then delete all but 2 via MockScopedDB directly
      for (let i = 0; i < 5; i++) {
        await createManualBackup(JSON.stringify([{ name: `S${i}` }]));
      }

      const countBefore = await getBackupCount();
      expect(countBefore.data).toBe(5);

      // Use the mock DB directly to test deleteOldBackups with keepCount=2
      const db = createMockScopedDB();
      const deleted = await db.deleteOldBackups(2);
      expect(deleted).toBe(3);

      const countAfter = await getBackupCount();
      expect(countAfter.data).toBe(2);
    });
  });

  // ── Restore ─────────────────────────────────────────────────────────

  describe("restoreBackup", () => {
    it("restores secrets from backup data", async () => {
      const backupData = JSON.stringify([
        { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
        { name: "AWS", secret: "GEZDGNBVGY3TQOJQ" },
      ]);

      const result = await restoreBackup(backupData);
      expect(result.success).toBe(true);
      expect(result.data!.imported).toBe(2);
      expect(result.data!.skipped).toBe(0);
      expect(result.data!.duplicates).toBe(0);
    });

    it("skips duplicates from existing secrets", async () => {
      // Import first
      await restoreBackup(JSON.stringify([
        { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      ]));

      // Try to restore the same data again
      const result = await restoreBackup(JSON.stringify([
        { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
        { name: "AWS", secret: "GEZDGNBVGY3TQOJQ" },
      ]));

      expect(result.success).toBe(true);
      expect(result.data!.imported).toBe(1);
      expect(result.data!.duplicates).toBe(1);
    });

    it("rejects empty backup data", async () => {
      const result = await restoreBackup("");
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects invalid/encrypted data", async () => {
      const result = await restoreBackup("not json");
      expect(result.success).toBe(false);
      expect(result.error).toContain("encrypted");
    });

    it("rejects empty array", async () => {
      const result = await restoreBackup("[]");
      expect(result.success).toBe(false);
      expect(result.error).toContain("no secrets");
    });

    it("restores from worker cron format (version 1 object)", async () => {
      const cronBackup = JSON.stringify({
        timestamp: "2026-03-20T00:00:00Z",
        version: "1.0",
        count: 2,
        secrets: [
          { id: "s1", name: "GitHub", account: null, secret: "JBSWY3DPEHPK3PXP", type: "totp", digits: 6, period: 30, algorithm: "SHA-1", counter: 0 },
          { id: "s2", name: "AWS", account: null, secret: "GEZDGNBVGY3TQOJQ", type: "totp", digits: 6, period: 30, algorithm: "SHA-1", counter: 0 },
        ],
      });

      const result = await restoreBackup(cronBackup);
      expect(result.success).toBe(true);
      expect(result.data!.imported).toBe(2);
    });

    it("restores from {secrets} format without version", async () => {
      const legacyBackup = JSON.stringify({
        secrets: [
          { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
        ],
      });

      const result = await restoreBackup(legacyBackup);
      expect(result.success).toBe(true);
      expect(result.data!.imported).toBe(1);
    });

    it("rejects unrecognized JSON object", async () => {
      const result = await restoreBackup('{"foo": "bar"}');
      expect(result.success).toBe(false);
      expect(result.error).toContain("Unrecognized backup format");
    });
  });
});
