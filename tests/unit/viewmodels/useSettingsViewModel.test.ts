/**
 * Settings ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockGetUserSettings,
  mockUpdateUserSettings,
  mockUseDashboardState,
} = vi.hoisted(() => {
  return {
    mockGetUserSettings: vi.fn(),
    mockUpdateUserSettings: vi.fn(),
    mockUseDashboardState: vi.fn(),
  };
});

vi.mock("@/actions/settings", () => ({
  getUserSettings: mockGetUserSettings,
  updateUserSettings: mockUpdateUserSettings,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardState: mockUseDashboardState,
  useDashboardActions: vi.fn().mockReturnValue({}),
}));

import { useSettingsViewModel } from "@/viewmodels/useSettingsViewModel";
import type { UserSettings } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const sampleSettings: UserSettings = {
  userId: "test-user",
  encryptionKeyHash: null,
  theme: "system",
  language: "en",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDashboardState.mockReturnValue({
    encryptionEnabled: false,
  });
  mockGetUserSettings.mockResolvedValue({
    success: true,
    data: sampleSettings,
  });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useSettingsViewModel", () => {
  describe("initial load", () => {
    it("loads settings on mount", async () => {
      const { result } = renderHook(() => useSettingsViewModel());

      // Wait for async load
      await act(async () => {});

      expect(result.current.settings).toEqual(sampleSettings);
      expect(result.current.loading).toBe(false);
    });

    it("reflects encryption status from context", async () => {
      mockUseDashboardState.mockReturnValue({ encryptionEnabled: true });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.encryptionEnabled).toBe(true);
    });

    it("sets error when load fails", async () => {
      mockGetUserSettings.mockResolvedValue({
        success: false,
        error: "Unauthorized",
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.error).toBe("Unauthorized");
      expect(result.current.settings).toBeNull();
    });

    it("sets generic error on exception", async () => {
      mockGetUserSettings.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.error).toBe("Failed to load settings");
    });
  });

  describe("handleUpdateTheme", () => {
    it("updates theme on success", async () => {
      const updatedSettings = { ...sampleSettings, theme: "dark" };
      mockUpdateUserSettings.mockResolvedValue({
        success: true,
        data: updatedSettings,
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleUpdateTheme("dark");
      });

      expect(success!).toBe(true);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({ theme: "dark" });
      expect(result.current.settings?.theme).toBe("dark");
    });

    it("sets error on failure", async () => {
      mockUpdateUserSettings.mockResolvedValue({
        success: false,
        error: "Invalid theme",
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleUpdateTheme("invalid");
      });

      expect(result.current.error).toBe("Invalid theme");
    });
  });

  describe("handleUpdateLanguage", () => {
    it("updates language on success", async () => {
      const updatedSettings = { ...sampleSettings, language: "zh" };
      mockUpdateUserSettings.mockResolvedValue({
        success: true,
        data: updatedSettings,
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleUpdateLanguage("zh");
      });

      expect(success!).toBe(true);
      expect(result.current.settings?.language).toBe("zh");
    });
  });

  describe("handleUpdateEncryption", () => {
    it("updates encryption key hash", async () => {
      const updatedSettings = { ...sampleSettings, encryptionKeyHash: "hash123" };
      mockUpdateUserSettings.mockResolvedValue({
        success: true,
        data: updatedSettings,
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleUpdateEncryption("hash123");
      });

      expect(success!).toBe(true);
      expect(mockUpdateUserSettings).toHaveBeenCalledWith({ encryptionKeyHash: "hash123" });
    });

    it("can clear encryption key hash", async () => {
      const updatedSettings = { ...sampleSettings, encryptionKeyHash: null };
      mockUpdateUserSettings.mockResolvedValue({
        success: true,
        data: updatedSettings,
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleUpdateEncryption(null);
      });

      expect(mockUpdateUserSettings).toHaveBeenCalledWith({ encryptionKeyHash: null });
    });
  });

  describe("reload", () => {
    it("reloads settings from server", async () => {
      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      const updatedSettings = { ...sampleSettings, theme: "dark" };
      mockGetUserSettings.mockResolvedValue({
        success: true,
        data: updatedSettings,
      });

      await act(async () => {
        await result.current.reload();
      });

      expect(result.current.settings?.theme).toBe("dark");
    });
  });

  describe("clearError", () => {
    it("clears error state", async () => {
      mockUpdateUserSettings.mockResolvedValue({
        success: false,
        error: "some error",
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleUpdateTheme("invalid");
      });
      expect(result.current.error).toBe("some error");

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });
});
