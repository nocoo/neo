/**
 * ScopedDB unit tests — all methods mocked against executeD1Query.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockExecuteD1Query } = vi.hoisted(() => {
  return { mockExecuteD1Query: vi.fn() };
});

vi.mock("@/lib/db/d1-client", () => ({
  executeD1Query: mockExecuteD1Query,
}));

vi.mock("@/lib/db/mappers", () => ({
  rowToSecret: (row: Record<string, unknown>) => ({ ...row, _mapped: "secret" }),
  rowToUserSettings: (row: Record<string, unknown>) => ({ ...row, _mapped: "settings" }),
}));

import { ScopedDB, verifyBackyPullWebhook } from "@/lib/db/scoped";

describe("ScopedDB", () => {
  const userId = "user-123";
  let db: ScopedDB;

  beforeEach(() => {
    vi.clearAllMocks();
    db = new ScopedDB(userId);
  });

  // ── Secrets ─────────────────────────────────────────────────────────────

  describe("getSecrets", () => {
    it("returns mapped secrets ordered by created_at DESC", async () => {
      const rows = [{ id: "s1" }, { id: "s2" }];
      mockExecuteD1Query.mockResolvedValue(rows);

      const result = await db.getSecrets();

      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM secrets WHERE user_id = ?"),
        [userId]
      );
      expect(result).toHaveLength(2);
      expect(result[0]!).toHaveProperty("_mapped", "secret");
    });
  });

  describe("getSecretById", () => {
    it("returns mapped secret when found", async () => {
      mockExecuteD1Query.mockResolvedValue([{ id: "s1" }]);
      const result = await db.getSecretById("s1");
      expect(result).toHaveProperty("_mapped", "secret");
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id = ? AND user_id = ?"),
        ["s1", userId]
      );
    });

    it("returns null when not found", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getSecretById("nope");
      expect(result).toBeNull();
    });
  });

  describe("createSecret", () => {
    it("inserts and returns mapped secret", async () => {
      const input = {
        id: "s1",
        name: "Test",
        account: null,
        secret: "JBSWY3DPEHPK3PXP",
        type: "totp",
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
        counter: 0,
      };
      mockExecuteD1Query.mockResolvedValue([{ id: "s1", name: "Test" }]);

      const result = await db.createSecret(input);

      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO secrets"),
        expect.arrayContaining(["s1", userId, "Test"])
      );
      expect(result).toHaveProperty("_mapped", "secret");
    });

    it("passes color when provided", async () => {
      const input = {
        id: "s1",
        name: "Test",
        account: "acct",
        secret: "JBSWY3DPEHPK3PXP",
        type: "totp",
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
        counter: 0,
        color: "#ff0000",
      };
      mockExecuteD1Query.mockResolvedValue([{ id: "s1" }]);

      await db.createSecret(input);

      const params = mockExecuteD1Query.mock.calls[0]![1];
      expect(params).toContain("#ff0000");
    });
  });

  describe("updateSecret", () => {
    it("updates and returns mapped secret", async () => {
      mockExecuteD1Query.mockResolvedValue([{ id: "s1", name: "Updated" }]);
      const result = await db.updateSecret("s1", { name: "Updated" });
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE secrets SET"),
        expect.arrayContaining(["Updated", "s1", userId])
      );
      expect(result).toHaveProperty("_mapped", "secret");
    });

    it("returns null when secret not found after update", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.updateSecret("s1", { name: "Updated" });
      expect(result).toBeNull();
    });

    it("delegates to getSecretById when no fields to update", async () => {
      mockExecuteD1Query.mockResolvedValue([{ id: "s1" }]);
      const result = await db.updateSecret("s1", {});
      // Should call getSecretById instead of UPDATE
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM secrets WHERE id = ?"),
        ["s1", userId]
      );
      expect(result).toHaveProperty("_mapped", "secret");
    });

    it("skips undefined values in update data", async () => {
      mockExecuteD1Query.mockResolvedValue([{ id: "s1" }]);
      await db.updateSecret("s1", { name: "New", account: undefined } as unknown as Parameters<typeof db.updateSecret>[1]);
      const sql = mockExecuteD1Query.mock.calls[0]![0];
      expect(sql).toContain("name = ?");
      expect(sql).not.toContain("account = ?");
    });
  });

  describe("deleteSecret", () => {
    it("soft-deletes and returns true", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.deleteSecret("s1");
      expect(result).toBe(true);
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE secrets SET deleted_at = ?"),
        expect.arrayContaining(["s1", userId])
      );
    });
  });

  describe("getSecretCount", () => {
    it("returns count from query result", async () => {
      mockExecuteD1Query.mockResolvedValue([{ count: 5 }]);
      const result = await db.getSecretCount();
      expect(result).toBe(5);
    });

    it("returns 0 when no rows", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getSecretCount();
      expect(result).toBe(0);
    });

    it("filters out soft-deleted secrets", async () => {
      mockExecuteD1Query.mockResolvedValue([{ count: 3 }]);
      await db.getSecretCount();
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("deleted_at IS NULL"),
        [userId]
      );
    });
  });

  // ── Recycle Bin ──────────────────────────────────────────────────────────

  describe("getDeletedSecrets", () => {
    it("returns soft-deleted secrets", async () => {
      mockExecuteD1Query.mockResolvedValue([{ id: "s1" }]);
      const result = await db.getDeletedSecrets();
      expect(result).toHaveLength(1);
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("deleted_at IS NOT NULL"),
        [userId]
      );
    });
  });

  describe("restoreSecret", () => {
    it("restores and returns the secret", async () => {
      mockExecuteD1Query.mockResolvedValue([{ id: "s1" }]);
      const result = await db.restoreSecret("s1");
      expect(result).toHaveProperty("_mapped", "secret");
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("SET deleted_at = NULL"),
        expect.arrayContaining(["s1", userId])
      );
    });

    it("returns null when not found", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.restoreSecret("nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("permanentDeleteSecret", () => {
    it("permanently deletes from recycle bin", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.permanentDeleteSecret("s1");
      expect(result).toBe(true);
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM secrets"),
        ["s1", userId]
      );
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("deleted_at IS NOT NULL"),
        ["s1", userId]
      );
    });
  });

  describe("emptyRecycleBin", () => {
    it("deletes all soft-deleted secrets and returns count", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([{ count: 3 }])
        .mockResolvedValueOnce([]);
      const result = await db.emptyRecycleBin();
      expect(result).toBe(3);
    });

    it("returns 0 when bin is empty", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([]);
      const result = await db.emptyRecycleBin();
      expect(result).toBe(0);
    });
  });

  // ── User Settings ──────────────────────────────────────────────────────

  describe("getUserSettings", () => {
    it("returns mapped settings when found", async () => {
      mockExecuteD1Query.mockResolvedValue([{ user_id: userId }]);
      const result = await db.getUserSettings();
      expect(result).toHaveProperty("_mapped", "settings");
    });

    it("returns null when not found", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getUserSettings();
      expect(result).toBeNull();
    });
  });

  describe("upsertUserSettings", () => {
    it("updates existing settings", async () => {
      // First call: getUserSettings returns existing
      mockExecuteD1Query
        .mockResolvedValueOnce([{ user_id: userId, _mapped: "settings" }])
        .mockResolvedValueOnce([{ user_id: userId, theme: "dark" }]);

      const result = await db.upsertUserSettings({ theme: "dark" });

      expect(mockExecuteD1Query).toHaveBeenCalledTimes(2);
      const updateSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(updateSql).toContain("UPDATE user_settings SET");
      expect(result).toHaveProperty("_mapped", "settings");
    });

    it("returns existing settings when no changes", async () => {
      const existing = { user_id: userId, _mapped: "settings" };
      mockExecuteD1Query.mockResolvedValueOnce([existing]);

      const result = await db.upsertUserSettings({});

      expect(mockExecuteD1Query).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("_mapped", "settings");
    });

    it("inserts new settings when none exist", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([]) // getUserSettings returns null
        .mockResolvedValueOnce([{ user_id: userId }]); // INSERT RETURNING

      const result = await db.upsertUserSettings({ theme: "dark" });

      const insertSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(insertSql).toContain("INSERT INTO user_settings");
      expect(result).toHaveProperty("_mapped", "settings");
    });

    it("converts camelCase keys to snake_case in UPDATE", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([{ user_id: userId, _mapped: "settings" }])
        .mockResolvedValueOnce([{ user_id: userId }]);

      await db.upsertUserSettings({ encryptionKeyHash: "abc" });

      const updateSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(updateSql).toContain("encryption_key_hash = ?");
    });
  });

  // ── Encryption Key ─────────────────────────────────────────────────────

  describe("getEncryptionKey", () => {
    it("returns encryption key from settings", async () => {
      // rowToUserSettings mock returns { ...row, _mapped: "settings" }
      // so we need encryption_key in the raw row to survive as encryptionKey
      // Actually, the mock mapper passes through all fields.
      // getEncryptionKey calls getUserSettings which calls rowToUserSettings.
      // Our mock rowToUserSettings just spreads the row, so settings.encryptionKey
      // would be undefined. We need the mock to produce the right field name.
      mockExecuteD1Query.mockResolvedValue([
        { user_id: userId, encryptionKey: "key123" },
      ]);
      const result = await db.getEncryptionKey();
      expect(result).toBe("key123");
    });

    it("returns null when no settings", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getEncryptionKey();
      expect(result).toBeNull();
    });
  });

  describe("setEncryptionKey", () => {
    it("updates existing settings", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([{ user_id: userId }]) // getUserSettings
        .mockResolvedValueOnce([]); // UPDATE

      await db.setEncryptionKey("new-key");

      const updateSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(updateSql).toContain("UPDATE user_settings SET encryption_key = ?");
    });

    it("inserts when no settings exist", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([]) // getUserSettings returns null
        .mockResolvedValueOnce([]); // INSERT

      await db.setEncryptionKey("new-key");

      const insertSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(insertSql).toContain("INSERT INTO user_settings");
      expect(mockExecuteD1Query.mock.calls[1]![1]).toContain("new-key");
    });
  });

  // ── Backy Settings ─────────────────────────────────────────────────────

  describe("getBackySettings", () => {
    it("returns webhook url and api key from settings", async () => {
      // Mock mapper spreads raw row, so use camelCase field names
      mockExecuteD1Query.mockResolvedValue([
        { user_id: userId, backyWebhookUrl: "https://example.com", backyApiKey: "key" },
      ]);
      const result = await db.getBackySettings();
      expect(result).toEqual({
        webhookUrl: "https://example.com",
        apiKey: "key",
      });
    });

    it("returns nulls when no settings", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getBackySettings();
      expect(result).toEqual({ webhookUrl: null, apiKey: null });
    });
  });

  describe("upsertBackySettings", () => {
    it("updates existing settings", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([{ user_id: userId }])
        .mockResolvedValueOnce([]);

      await db.upsertBackySettings({ webhookUrl: "https://new.com", apiKey: "k" });

      const updateSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(updateSql).toContain("UPDATE user_settings SET backy_webhook_url = ?");
    });

    it("inserts when no settings exist", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await db.upsertBackySettings({ webhookUrl: "https://new.com", apiKey: "k" });

      const insertSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(insertSql).toContain("INSERT INTO user_settings");
    });
  });

  // ── Backy Pull Webhook ─────────────────────────────────────────────────

  describe("getBackyPullWebhook", () => {
    it("returns pull key from settings", async () => {
      mockExecuteD1Query.mockResolvedValue([
        { user_id: userId, backyPullKey: "pull-key" },
      ]);
      const result = await db.getBackyPullWebhook();
      expect(result).toBe("pull-key");
    });

    it("returns null when no settings", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getBackyPullWebhook();
      expect(result).toBeNull();
    });
  });

  describe("upsertBackyPullWebhook", () => {
    it("updates existing settings", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([{ user_id: userId }])
        .mockResolvedValueOnce([]);

      await db.upsertBackyPullWebhook("new-pull-key");

      const updateSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(updateSql).toContain("UPDATE user_settings SET backy_pull_key = ?");
    });

    it("inserts when no settings exist", async () => {
      mockExecuteD1Query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await db.upsertBackyPullWebhook("new-pull-key");

      const insertSql = mockExecuteD1Query.mock.calls[1]![0];
      expect(insertSql).toContain("INSERT INTO user_settings");
    });
  });

  describe("deleteBackyPullWebhook", () => {
    it("sets backy_pull_key to NULL", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      await db.deleteBackyPullWebhook();
      expect(mockExecuteD1Query).toHaveBeenCalledWith(
        expect.stringContaining("SET backy_pull_key = NULL"),
        [userId]
      );
    });
  });

  // ── Legacy Backups ─────────────────────────────────────────────────────

  describe("getLegacyBackupCount", () => {
    it("returns count of non-encrypted backups", async () => {
      mockExecuteD1Query.mockResolvedValue([{ count: 3 }]);
      const result = await db.getLegacyBackupCount();
      expect(result).toBe(3);
    });

    it("returns 0 when no rows", async () => {
      mockExecuteD1Query.mockResolvedValue([]);
      const result = await db.getLegacyBackupCount();
      expect(result).toBe(0);
    });

    it("returns 0 when table does not exist", async () => {
      mockExecuteD1Query.mockRejectedValue(new Error("no such table"));
      const result = await db.getLegacyBackupCount();
      expect(result).toBe(0);
    });
  });

  describe("getLegacyBackups", () => {
    it("returns mapped legacy backup rows", async () => {
      mockExecuteD1Query.mockResolvedValue([
        {
          id: "b1",
          filename: "backup.zip",
          data: "{}",
          secret_count: 5,
          encrypted: 0,
          hash: "abc",
          created_at: 1700000000,
        },
      ]);

      const result = await db.getLegacyBackups();

      expect(result).toHaveLength(1);
      expect(result[0]!).toEqual({
        id: "b1",
        filename: "backup.zip",
        data: "{}",
        secretCount: 5,
        encrypted: false,
        hash: "abc",
        createdAt: 1700000000,
      });
    });

    it("returns empty array when table does not exist", async () => {
      mockExecuteD1Query.mockRejectedValue(new Error("no such table"));
      const result = await db.getLegacyBackups();
      expect(result).toEqual([]);
    });

    it("converts encrypted flag to boolean", async () => {
      mockExecuteD1Query.mockResolvedValue([
        {
          id: "b2",
          filename: "enc.zip",
          data: "{}",
          secret_count: 1,
          encrypted: 1,
          hash: "def",
          created_at: 1700000000,
        },
      ]);

      const result = await db.getLegacyBackups();
      expect(result[0]!.encrypted).toBe(true);
    });
  });
});

// ── Standalone queries ───────────────────────────────────────────────────

describe("verifyBackyPullWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userId when key matches", async () => {
    mockExecuteD1Query.mockResolvedValue([{ user_id: "u1" }]);
    const result = await verifyBackyPullWebhook("valid-key");
    expect(result).toEqual({ userId: "u1" });
  });

  it("returns null when key does not match", async () => {
    mockExecuteD1Query.mockResolvedValue([]);
    const result = await verifyBackyPullWebhook("invalid-key");
    expect(result).toBeNull();
  });
});
