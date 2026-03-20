/**
 * Dashboard data fetch action tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSecrets,
  mockGetUserSettings,
  mockScopedDB,
} = vi.hoisted(() => {
  const mockGetSecrets = vi.fn();
  const mockGetUserSettings = vi.fn();

  return {
    mockGetSecrets,
    mockGetUserSettings,
    mockScopedDB: {
      getSecrets: mockGetSecrets,
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
    mockGetSecrets.mockResolvedValue([{ id: "s1", name: "GitHub" }]);
    mockGetUserSettings.mockResolvedValue({ encryptionKey: "someKey" });

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secrets).toHaveLength(1);
      expect(result.data.encryptionEnabled).toBe(true);
    }
  });

  it("handles no settings", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockGetUserSettings.mockResolvedValue(null);

    const result = await getDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secrets).toHaveLength(0);
      expect(result.data.encryptionEnabled).toBe(false);
    }
  });

  it("fetches all data in parallel", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockGetUserSettings.mockResolvedValue(null);

    await getDashboardData();

    expect(mockGetSecrets).toHaveBeenCalledTimes(1);
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
