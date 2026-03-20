/**
 * Backup ViewModel tests.
 *
 * New flow: archive download, push to Backy, restore from ZIP.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockPushToBacky,
  mockFetchHistory,
  mockRefresh,
  mockUseDashboardState,
} = vi.hoisted(() => {
  return {
    mockPushToBacky: vi.fn(),
    mockFetchHistory: vi.fn(),
    mockRefresh: vi.fn().mockResolvedValue(undefined),
    mockUseDashboardState: vi.fn(),
  };
});

vi.mock("@/actions/backy", () => ({
  pushBackupToBacky: mockPushToBacky,
  fetchBackyHistory: mockFetchHistory,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardActions: vi.fn().mockReturnValue({ refresh: mockRefresh }),
  useDashboardState: mockUseDashboardState,
}));

import { useBackupViewModel } from "@/viewmodels/useBackupViewModel";

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDashboardState.mockReturnValue({ encryptionEnabled: true });
  mockFetchHistory.mockResolvedValue({ success: true, data: { project_name: "neo", environment: null, total_backups: 0, recent_backups: [] } });
  // Mock global fetch for archive download and restore
  vi.stubGlobal("fetch", vi.fn());
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useBackupViewModel", () => {
  describe("initial state", () => {
    it("starts not busy with no error", async () => {
      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      expect(result.current.busy).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.lastPushResult).toBeNull();
      expect(result.current.lastRestoreResult).toBeNull();
    });

    it("fetches history on mount", async () => {
      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      expect(mockFetchHistory).toHaveBeenCalled();
      expect(result.current.history).toBeDefined();
    });
  });

  describe("handleDownloadArchive", () => {
    it("sets error when encryption not enabled", async () => {
      mockUseDashboardState.mockReturnValue({ encryptionEnabled: false });

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleDownloadArchive();
      });

      expect(result.current.error).toContain("encryption key");
    });

    it("triggers download on success", async () => {
      const mockBlob = new Blob(["zip"], { type: "application/zip" });
      const mockCreateObjectURL = vi.fn().mockReturnValue("blob:mock");
      const mockRevokeObjectURL = vi.fn();
      globalThis.URL.createObjectURL = mockCreateObjectURL;
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
        headers: new Headers({ "Content-Disposition": 'attachment; filename="neo-backup-2026-03-20.zip"' }),
      } as Response);

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleDownloadArchive();
      });

      expect(fetch).toHaveBeenCalledWith("/api/backup/archive");
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:mock");
      expect(result.current.error).toBeNull();
    });

    it("sets error on download failure", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "No encryption key" }),
      } as Response);

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleDownloadArchive();
      });

      expect(result.current.error).toBe("No encryption key");
    });
  });

  describe("handlePushToBacky", () => {
    it("pushes backup and updates history", async () => {
      const pushDetail = {
        ok: true,
        message: "Push successful (100ms)",
        durationMs: 100,
        request: { tag: "neo/1.0", fileName: "backup.zip", fileSizeBytes: 1024, secretCount: 5 },
        history: { project_name: "neo", environment: null, total_backups: 1, recent_backups: [{ id: "b1", tag: "neo/1.0", environment: "production", file_size: 1024, is_single_json: 0, created_at: "2026-03-20" }] },
      };
      mockPushToBacky.mockResolvedValue({ success: true, data: pushDetail });

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handlePushToBacky();
      });

      expect(success!).toBe(true);
      expect(result.current.lastPushResult).toEqual(pushDetail);
      expect(result.current.history?.total_backups).toBe(1);
    });

    it("sets error on push failure", async () => {
      mockPushToBacky.mockResolvedValue({ success: false, error: "Backy not configured" });

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handlePushToBacky();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Backy not configured");
    });

    it("handles exception during push", async () => {
      mockPushToBacky.mockRejectedValue(new Error("network"));

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handlePushToBacky();
      });

      expect(result.current.error).toBe("Failed to push backup to Backy");
    });
  });

  describe("handleRestore", () => {
    it("restores from file and refreshes dashboard", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, imported: 3, skipped: 0, duplicates: 1 }),
      } as Response);

      const file = new File(["zip-content"], "backup.zip", { type: "application/zip" });

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRestore(file, "encKey123");
      });

      expect(success!).toBe(true);
      expect(result.current.lastRestoreResult).toEqual({ imported: 3, skipped: 0, duplicates: 1 });
      expect(mockRefresh).toHaveBeenCalled();

      // Verify fetch was called with correct FormData
      const fetchCall = vi.mocked(fetch).mock.calls.find((c) => c[0] === "/api/backup/restore");
      expect(fetchCall).toBeDefined();
      const body = fetchCall![1]?.body as FormData;
      expect(body.get("file")).toBeDefined();
      expect(body.get("encryptionKey")).toBe("encKey123");
    });

    it("sets error on restore failure", async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Decryption failed" }),
      } as Response);

      const file = new File(["zip"], "backup.zip");

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRestore(file, "badKey");
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Decryption failed");
      expect(mockRefresh).not.toHaveBeenCalled();
    });

    it("handles exception during restore", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("network"));

      const file = new File(["zip"], "backup.zip");

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleRestore(file, "key");
      });

      expect(result.current.error).toBe("Failed to restore backup");
    });
  });

  describe("clearError", () => {
    it("clears error state", async () => {
      mockPushToBacky.mockResolvedValue({ success: false, error: "some error" });

      const { result } = renderHook(() => useBackupViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handlePushToBacky();
      });
      expect(result.current.error).toBe("some error");

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });
});
