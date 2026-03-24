/**
 * RecycleBin ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockGetDeletedSecrets,
  mockRestoreSecret,
  mockPermanentDeleteSecret,
  mockEmptyRecycleBin,
} = vi.hoisted(() => {
  const mockGetDeletedSecrets = vi.fn();
  const mockRestoreSecret = vi.fn();
  const mockPermanentDeleteSecret = vi.fn();
  const mockEmptyRecycleBin = vi.fn();

  return {
    mockGetDeletedSecrets,
    mockRestoreSecret,
    mockPermanentDeleteSecret,
    mockEmptyRecycleBin,
  };
});

vi.mock("@/actions/secrets", () => ({
  getDeletedSecrets: mockGetDeletedSecrets,
  restoreSecret: mockRestoreSecret,
  permanentDeleteSecret: mockPermanentDeleteSecret,
  emptyRecycleBin: mockEmptyRecycleBin,
}));

import { useRecycleBinViewModel } from "@/viewmodels/useRecycleBinViewModel";
import type { Secret } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const deletedSecret: Secret = {
  id: "s_del_1",
  userId: "test-user",
  name: "GitHub",
  account: "user@example.com",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  algorithm: "SHA-1",
  counter: 0,
  color: null,
  deletedAt: new Date("2026-03-20T10:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-03-20T10:00:00Z"),
};

const deletedSecret2: Secret = {
  ...deletedSecret,
  id: "s_del_2",
  name: "GitLab",
  account: "admin@gitlab.com",
  deletedAt: new Date("2026-03-21T10:00:00Z"),
};

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useRecycleBinViewModel", () => {
  describe("initial state", () => {
    it("uses initialSecrets", () => {
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );
      expect(result.current.deletedSecrets).toHaveLength(2);
      expect(result.current.filteredSecrets).toHaveLength(2);
      expect(result.current.loading).toBe(false);
      expect(result.current.busy).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it("defaults to empty list", () => {
      const { result } = renderHook(() => useRecycleBinViewModel());
      expect(result.current.deletedSecrets).toHaveLength(0);
    });
  });

  describe("search", () => {
    it("filters by name", () => {
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );
      act(() => result.current.setSearchQuery("github"));
      expect(result.current.filteredSecrets).toHaveLength(1);
      expect(result.current.filteredSecrets[0]!.name).toBe("GitHub");
    });

    it("filters by account", () => {
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );
      act(() => result.current.setSearchQuery("admin"));
      expect(result.current.filteredSecrets).toHaveLength(1);
      expect(result.current.filteredSecrets[0]!.name).toBe("GitLab");
    });

    it("shows all when query is empty", () => {
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );
      act(() => result.current.setSearchQuery("github"));
      act(() => result.current.setSearchQuery(""));
      expect(result.current.filteredSecrets).toHaveLength(2);
    });
  });

  describe("handleRestore", () => {
    it("removes restored secret from list on success", async () => {
      mockRestoreSecret.mockResolvedValue({ success: true, data: deletedSecret });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRestore(deletedSecret.id);
      });
      expect(success!).toBe(true);
      expect(result.current.deletedSecrets).toHaveLength(1);
      expect(result.current.deletedSecrets[0]!.id).toBe(deletedSecret2.id);
    });

    it("sets error on failure", async () => {
      mockRestoreSecret.mockResolvedValue({ success: false, error: "Not found" });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRestore(deletedSecret.id);
      });
      expect(success!).toBe(false);
      expect(result.current.error).toBe("Not found");
      expect(result.current.deletedSecrets).toHaveLength(1);
    });

    it("handles thrown error", async () => {
      mockRestoreSecret.mockRejectedValue(new Error("Network error"));
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      await act(async () => {
        await result.current.handleRestore(deletedSecret.id);
      });
      expect(result.current.error).toBe("Failed to restore secret");
    });
  });

  describe("handlePermanentDelete", () => {
    it("removes permanently deleted secret from list", async () => {
      mockPermanentDeleteSecret.mockResolvedValue({ success: true, data: undefined });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.handlePermanentDelete(deletedSecret.id);
      });
      expect(success!).toBe(true);
      expect(result.current.deletedSecrets).toHaveLength(1);
    });

    it("sets error on failure", async () => {
      mockPermanentDeleteSecret.mockResolvedValue({ success: false, error: "DB error" });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.handlePermanentDelete(deletedSecret.id);
      });
      expect(success!).toBe(false);
      expect(result.current.error).toBe("DB error");
    });

    it("handles thrown error", async () => {
      mockPermanentDeleteSecret.mockRejectedValue(new Error("Network"));
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      await act(async () => {
        await result.current.handlePermanentDelete(deletedSecret.id);
      });
      expect(result.current.error).toBe("Failed to permanently delete secret");
    });
  });

  describe("handleEmptyBin", () => {
    it("clears all deleted secrets on success", async () => {
      mockEmptyRecycleBin.mockResolvedValue({ success: true, data: 2 });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret, deletedSecret2]),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.handleEmptyBin();
      });
      expect(success!).toBe(true);
      expect(result.current.deletedSecrets).toHaveLength(0);
    });

    it("sets error on failure", async () => {
      mockEmptyRecycleBin.mockResolvedValue({ success: false, error: "Failed" });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      let success: boolean;
      await act(async () => {
        success = await result.current.handleEmptyBin();
      });
      expect(success!).toBe(false);
      expect(result.current.error).toBe("Failed");
      expect(result.current.deletedSecrets).toHaveLength(1);
    });

    it("handles thrown error", async () => {
      mockEmptyRecycleBin.mockRejectedValue(new Error("Network"));
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      await act(async () => {
        await result.current.handleEmptyBin();
      });
      expect(result.current.error).toBe("Failed to empty recycle bin");
    });
  });

  describe("refresh", () => {
    it("fetches and replaces deleted secrets", async () => {
      mockGetDeletedSecrets.mockResolvedValue({
        success: true,
        data: [deletedSecret2],
      });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.deletedSecrets).toHaveLength(1);
      expect(result.current.deletedSecrets[0]!.id).toBe(deletedSecret2.id);
    });

    it("sets error on failure", async () => {
      mockGetDeletedSecrets.mockResolvedValue({ success: false, error: "DB error" });
      const { result } = renderHook(() => useRecycleBinViewModel());

      await act(async () => {
        await result.current.refresh();
      });
      expect(result.current.error).toBe("DB error");
    });
  });

  describe("clearError", () => {
    it("clears the error state", async () => {
      mockRestoreSecret.mockResolvedValue({ success: false, error: "Some error" });
      const { result } = renderHook(() =>
        useRecycleBinViewModel([deletedSecret]),
      );

      await act(async () => {
        await result.current.handleRestore(deletedSecret.id);
      });
      expect(result.current.error).toBe("Some error");

      act(() => result.current.clearError());
      expect(result.current.error).toBeNull();
    });
  });
});
