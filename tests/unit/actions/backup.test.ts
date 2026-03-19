/**
 * Backup server actions tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────

const {
  mockGetBackups,
  mockGetLatestBackup,
  mockGetBackupCount,
  mockCreateBackup,
  mockDeleteOldBackups,
  mockScopedDB,
} = vi.hoisted(() => {
  const mockGetBackups = vi.fn();
  const mockGetLatestBackup = vi.fn();
  const mockGetBackupCount = vi.fn();
  const mockCreateBackup = vi.fn();
  const mockDeleteOldBackups = vi.fn();

  return {
    mockGetBackups,
    mockGetLatestBackup,
    mockGetBackupCount,
    mockCreateBackup,
    mockDeleteOldBackups,
    mockScopedDB: {
      getBackups: mockGetBackups,
      getLatestBackup: mockGetLatestBackup,
      getBackupCount: mockGetBackupCount,
      createBackup: mockCreateBackup,
      deleteOldBackups: mockDeleteOldBackups,
    },
  };
});

vi.mock("@/lib/auth-context", () => ({
  getScopedDB: vi.fn().mockResolvedValue(mockScopedDB),
  getSession: vi.fn(),
  getAuthContext: vi.fn(),
  requireAuth: vi.fn(),
}));

import {
  getBackups,
  getLatestBackup,
  getBackupCount,
  createManualBackup,
  cleanupBackups,
} from "@/actions/backup";
import { getScopedDB } from "@/lib/auth-context";

// ── Sample data ─────────────────────────────────────────────────────────

const sampleBackup = {
  id: "bk_test_123",
  userId: "test-user-id",
  filename: "backup_2026-03-19_14-00-00.json",
  data: '[{"name":"GitHub","secret":"JBSWY3DPEHPK3PXP"}]',
  secretCount: 1,
  encrypted: false,
  reason: "manual",
  hash: "abc123",
  createdAt: new Date(),
};

// ── Setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScopedDB).mockResolvedValue(mockScopedDB as never);
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("getBackups", () => {
  it("returns backups for authenticated user", async () => {
    mockGetBackups.mockResolvedValue([sampleBackup]);
    const result = await getBackups();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
    }
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getBackups();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("handles errors gracefully", async () => {
    mockGetBackups.mockRejectedValue(new Error("DB error"));
    const result = await getBackups();
    expect(result.success).toBe(false);
  });
});

describe("getLatestBackup", () => {
  it("returns latest backup", async () => {
    mockGetLatestBackup.mockResolvedValue(sampleBackup);
    const result = await getLatestBackup();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.id).toBe("bk_test_123");
  });

  it("returns null when no backups exist", async () => {
    mockGetLatestBackup.mockResolvedValue(null);
    const result = await getLatestBackup();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getLatestBackup();
    expect(result.success).toBe(false);
  });
});

describe("getBackupCount", () => {
  it("returns count", async () => {
    mockGetBackupCount.mockResolvedValue(42);
    const result = await getBackupCount();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getBackupCount();
    expect(result.success).toBe(false);
  });
});

describe("createManualBackup", () => {
  it("creates backup with valid data", async () => {
    mockCreateBackup.mockResolvedValue(sampleBackup);
    mockDeleteOldBackups.mockResolvedValue(0);
    const data = JSON.stringify([{ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" }]);
    const result = await createManualBackup(data);
    expect(result.success).toBe(true);
    expect(mockCreateBackup).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "manual",
        secretCount: 1,
        encrypted: false,
      })
    );
  });

  it("triggers cleanup after backup", async () => {
    mockCreateBackup.mockResolvedValue(sampleBackup);
    mockDeleteOldBackups.mockResolvedValue(0);
    const data = JSON.stringify([{ name: "Test" }]);
    await createManualBackup(data);
    expect(mockDeleteOldBackups).toHaveBeenCalledWith(100);
  });

  it("rejects empty data", async () => {
    const result = await createManualBackup("");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Backup data is required");
  });

  it("rejects invalid JSON", async () => {
    const result = await createManualBackup("not json");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Invalid JSON data");
  });

  it("rejects non-array JSON", async () => {
    const result = await createManualBackup('{"not":"array"}');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Invalid backup data format");
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await createManualBackup("[]");
    expect(result.success).toBe(false);
  });

  it("handles database errors gracefully", async () => {
    mockCreateBackup.mockRejectedValue(new Error("DB error"));
    const data = JSON.stringify([{ name: "Test" }]);
    const result = await createManualBackup(data);
    expect(result.success).toBe(false);
  });
});

describe("cleanupBackups", () => {
  it("deletes old backups", async () => {
    mockDeleteOldBackups.mockResolvedValue(5);
    const result = await cleanupBackups();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.deleted).toBe(5);
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await cleanupBackups();
    expect(result.success).toBe(false);
  });

  it("handles errors gracefully", async () => {
    mockDeleteOldBackups.mockRejectedValue(new Error("DB error"));
    const result = await cleanupBackups();
    expect(result.success).toBe(false);
  });
});
