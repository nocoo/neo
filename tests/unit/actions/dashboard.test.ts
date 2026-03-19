/**
 * Dashboard data fetch action tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSecrets,
  mockGetBackupCount,
  mockGetLatestBackup,
  mockGetUserSettings,
  mockScopedDB,
} = vi.hoisted(() => {
  const mockGetSecrets = vi.fn();
  const mockGetBackupCount = vi.fn();
  const mockGetLatestBackup = vi.fn();
  const mockGetUserSettings = vi.fn();

  return {
    mockGetSecrets,
    mockGetBackupCount,
    mockGetLatestBackup,
    mockGetUserSettings,
    mockScopedDB: {
      getSecrets: mockGetSecrets,
      getBackupCount: mockGetBackupCount,
      getLatestBackup: mockGetLatestBackup,
      getUserSettings: mockGetUserSettings,
    },
  };
});

vi.mock("@/lib/auth-context", () => ({
  getScopedDB: vi.fn().mockResolvedValue(mockScopedDB),
  getSession: vi.fn(),
  getAuthContext: vi.fn(),
  requireAuth: vi.fn(),
}));

import { getDashboardData } from "@/actions/dashboard";
import { getScopedDB } from "@/lib/auth-context";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScopedDB).mockResolvedValue(mockScopedDB as never);
});

describe("getDashboardData", () => {
  it("returns aggregated dashboard data", async () => {
    const now = new Date();
    mockGetSecrets.mockResolvedValue([{ id: "s1", name: "GitHub" }]);
    mockGetBackupCount.mockResolvedValue(5);
    mockGetLatestBackup.mockResolvedValue({ id: "bk1", createdAt: now });
    mockGetUserSettings.mockResolvedValue({ encryptionKeyHash: "hash123" });

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secrets).toHaveLength(1);
      expect(result.data.backupCount).toBe(5);
      expect(result.data.lastBackupAt).toBe(now);
      expect(result.data.encryptionEnabled).toBe(true);
    }
  });

  it("handles no backups", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockGetBackupCount.mockResolvedValue(0);
    mockGetLatestBackup.mockResolvedValue(null);
    mockGetUserSettings.mockResolvedValue(null);

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secrets).toHaveLength(0);
      expect(result.data.backupCount).toBe(0);
      expect(result.data.lastBackupAt).toBeNull();
      expect(result.data.encryptionEnabled).toBe(false);
    }
  });

  it("fetches all data in parallel", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockGetBackupCount.mockResolvedValue(0);
    mockGetLatestBackup.mockResolvedValue(null);
    mockGetUserSettings.mockResolvedValue(null);

    await getDashboardData();

    // All four should be called
    expect(mockGetSecrets).toHaveBeenCalledTimes(1);
    expect(mockGetBackupCount).toHaveBeenCalledTimes(1);
    expect(mockGetLatestBackup).toHaveBeenCalledTimes(1);
    expect(mockGetUserSettings).toHaveBeenCalledTimes(1);
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getDashboardData();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("handles errors gracefully", async () => {
    mockGetSecrets.mockRejectedValue(new Error("DB error"));
    const result = await getDashboardData();
    expect(result.success).toBe(false);
  });
});
