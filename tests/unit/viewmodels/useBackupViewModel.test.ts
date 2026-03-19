/**
 * Backup ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockGetBackups,
  mockCreateManualBackup,
  mockCleanupBackups,
  mockUseDashboardState,
  mockHandleBackupCreated,
} = vi.hoisted(() => {
  const mockGetBackups = vi.fn();
  const mockCreateManualBackup = vi.fn();
  const mockCleanupBackups = vi.fn();
  const mockUseDashboardState = vi.fn();
  const mockHandleBackupCreated = vi.fn();

  return {
    mockGetBackups,
    mockCreateManualBackup,
    mockCleanupBackups,
    mockUseDashboardState,
    mockHandleBackupCreated,
  };
});

vi.mock("@/actions/backup", () => ({
  getBackups: mockGetBackups,
  createManualBackup: mockCreateManualBackup,
  cleanupBackups: mockCleanupBackups,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardState: mockUseDashboardState,
  useDashboardActions: vi.fn().mockReturnValue({
    handleBackupCreated: mockHandleBackupCreated,
  }),
}));

import { useBackupViewModel } from "@/viewmodels/useBackupViewModel";
import type { Backup } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const sampleBackup: Backup = {
  id: "bk_test_1",
  userId: "test-user",
  filename: "backup_20260319_000000.json",
  data: '[{"id":"s1","name":"GitHub"}]',
  secretCount: 1,
  encrypted: false,
  reason: "manual",
  hash: "abc12345",
  createdAt: new Date("2026-03-19T00:00:00Z"),
};

const sampleBackup2: Backup = {
  ...sampleBackup,
  id: "bk_test_2",
  createdAt: new Date("2026-03-18T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDashboardState.mockReturnValue({
    backupCount: 5,
    lastBackupAt: new Date("2026-03-19T00:00:00Z"),
  });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useBackupViewModel", () => {
  describe("initial state", () => {
    it("returns backup count and lastBackupAt from context", () => {
      const { result } = renderHook(() => useBackupViewModel());

      expect(result.current.backupCount).toBe(5);
      expect(result.current.lastBackupAt).toEqual(new Date("2026-03-19T00:00:00Z"));
    });

    it("starts with empty backups array", () => {
      const { result } = renderHook(() => useBackupViewModel());
      expect(result.current.backups).toHaveLength(0);
    });

    it("starts not busy with no error", () => {
      const { result } = renderHook(() => useBackupViewModel());
      expect(result.current.busy).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe("loadBackups", () => {
    it("loads backups from server", async () => {
      mockGetBackups.mockResolvedValue({
        success: true,
        data: [sampleBackup, sampleBackup2],
      });

      const { result } = renderHook(() => useBackupViewModel());

      await act(async () => {
        await result.current.loadBackups();
      });

      expect(result.current.backups).toHaveLength(2);
      expect(result.current.backups[0].id).toBe("bk_test_1");
    });

    it("sets error on failure", async () => {
      mockGetBackups.mockResolvedValue({
        success: false,
        error: "Unauthorized",
      });

      const { result } = renderHook(() => useBackupViewModel());

      await act(async () => {
        await result.current.loadBackups();
      });

      expect(result.current.backups).toHaveLength(0);
      expect(result.current.error).toBe("Unauthorized");
    });

    it("sets generic error on exception", async () => {
      mockGetBackups.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useBackupViewModel());

      await act(async () => {
        await result.current.loadBackups();
      });

      expect(result.current.error).toBe("Failed to load backups");
    });
  });

  describe("handleCreateBackup", () => {
    it("creates backup and syncs context", async () => {
      mockCreateManualBackup.mockResolvedValue({
        success: true,
        data: sampleBackup,
      });

      const { result } = renderHook(() => useBackupViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.handleCreateBackup('[{"id":"s1"}]');
      });

      expect(success!).toBe(true);
      expect(mockCreateManualBackup).toHaveBeenCalledWith('[{"id":"s1"}]');
      expect(mockHandleBackupCreated).toHaveBeenCalledWith(sampleBackup.createdAt);
      expect(result.current.backups).toHaveLength(1);
    });

    it("prepends new backup to local list", async () => {
      mockGetBackups.mockResolvedValue({
        success: true,
        data: [sampleBackup2],
      });
      mockCreateManualBackup.mockResolvedValue({
        success: true,
        data: sampleBackup,
      });

      const { result } = renderHook(() => useBackupViewModel());

      // Load existing backup first
      await act(async () => {
        await result.current.loadBackups();
      });
      expect(result.current.backups).toHaveLength(1);

      // Create new backup
      await act(async () => {
        await result.current.handleCreateBackup("[]");
      });

      expect(result.current.backups).toHaveLength(2);
      expect(result.current.backups[0].id).toBe("bk_test_1"); // New one is first
    });

    it("sets error on failure", async () => {
      mockCreateManualBackup.mockResolvedValue({
        success: false,
        error: "Backup data is required",
      });

      const { result } = renderHook(() => useBackupViewModel());

      const success = await act(async () => {
        return await result.current.handleCreateBackup("");
      });

      expect(success).toBe(false);
      expect(result.current.error).toBe("Backup data is required");
    });

    it("sets generic error on exception", async () => {
      mockCreateManualBackup.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useBackupViewModel());

      await act(async () => {
        await result.current.handleCreateBackup("[]");
      });

      expect(result.current.error).toBe("Failed to create backup");
    });
  });

  describe("handleCleanup", () => {
    it("cleans up and reloads backups", async () => {
      mockCleanupBackups.mockResolvedValue({
        success: true,
        data: { deleted: 3 },
      });
      mockGetBackups.mockResolvedValue({
        success: true,
        data: [sampleBackup],
      });

      const { result } = renderHook(() => useBackupViewModel());

      let cleanupResult: { deleted: number } | null;
      await act(async () => {
        cleanupResult = await result.current.handleCleanup();
      });

      expect(cleanupResult!).toEqual({ deleted: 3 });
      expect(mockGetBackups).toHaveBeenCalled();
      expect(result.current.backups).toHaveLength(1);
    });

    it("sets error on failure", async () => {
      mockCleanupBackups.mockResolvedValue({
        success: false,
        error: "Unauthorized",
      });

      const { result } = renderHook(() => useBackupViewModel());

      const cleanupResult = await act(async () => {
        return await result.current.handleCleanup();
      });

      expect(cleanupResult).toBeNull();
      expect(result.current.error).toBe("Unauthorized");
    });

    it("sets generic error on exception", async () => {
      mockCleanupBackups.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useBackupViewModel());

      await act(async () => {
        await result.current.handleCleanup();
      });

      expect(result.current.error).toBe("Failed to cleanup backups");
    });
  });

  describe("clearError", () => {
    it("clears error state", async () => {
      mockGetBackups.mockResolvedValue({
        success: false,
        error: "some error",
      });

      const { result } = renderHook(() => useBackupViewModel());

      await act(async () => {
        await result.current.loadBackups();
      });
      expect(result.current.error).toBe("some error");

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });
});
