/**
 * Settings ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockGetUserSettings,
  mockUpdateUserSettings,
  mockGetEncryptionKey,
  mockGenerateAndSaveKey,
  mockGetBackyConfig,
  mockSaveBackyConfig,
  mockTestBackyConnection,
  mockGetPullWebhook,
  mockGeneratePullWebhook,
  mockRevokePullWebhook,
  mockUseDashboardState,
  mockRefresh,
} = vi.hoisted(() => {
  return {
    mockGetUserSettings: vi.fn(),
    mockUpdateUserSettings: vi.fn(),
    mockGetEncryptionKey: vi.fn(),
    mockGenerateAndSaveKey: vi.fn(),
    mockGetBackyConfig: vi.fn(),
    mockSaveBackyConfig: vi.fn(),
    mockTestBackyConnection: vi.fn(),
    mockGetPullWebhook: vi.fn(),
    mockGeneratePullWebhook: vi.fn(),
    mockRevokePullWebhook: vi.fn(),
    mockUseDashboardState: vi.fn(),
    mockRefresh: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/actions/settings", () => ({
  getUserSettings: mockGetUserSettings,
  updateUserSettings: mockUpdateUserSettings,
  getEncryptionKey: mockGetEncryptionKey,
  generateAndSaveEncryptionKey: mockGenerateAndSaveKey,
}));

vi.mock("@/actions/backy", () => ({
  getBackyConfig: mockGetBackyConfig,
  saveBackyConfig: mockSaveBackyConfig,
  testBackyConnection: mockTestBackyConnection,
  getBackyPullWebhook: mockGetPullWebhook,
  generateBackyPullWebhook: mockGeneratePullWebhook,
  revokeBackyPullWebhook: mockRevokePullWebhook,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardState: mockUseDashboardState,
  useDashboardActions: vi.fn().mockReturnValue({ refresh: mockRefresh }),
}));

import { useSettingsViewModel } from "@/viewmodels/useSettingsViewModel";
import type { UserSettings } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const sampleSettings: UserSettings = {
  userId: "test-user",
  encryptionKeyHash: null,
  encryptionKey: null,
  backyWebhookUrl: null,
  backyApiKey: null,
  backyPullKey: null,
  theme: "system",
  language: "en",
};

function setupDefaultMocks() {
  mockUseDashboardState.mockReturnValue({ encryptionEnabled: false });
  mockGetUserSettings.mockResolvedValue({ success: true, data: sampleSettings });
  mockGetEncryptionKey.mockResolvedValue({ success: true, data: null });
  mockGetBackyConfig.mockResolvedValue({ success: true, data: null });
  mockGetPullWebhook.mockResolvedValue({ success: true, data: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useSettingsViewModel", () => {
  describe("initial load", () => {
    it("loads all settings on mount", async () => {
      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.settings).toEqual(sampleSettings);
      expect(result.current.encryptionKey).toBeNull();
      expect(result.current.backyWebhookUrl).toBeNull();
      expect(result.current.backyPullKey).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("loads encryption key when present", async () => {
      mockGetEncryptionKey.mockResolvedValue({ success: true, data: "dGVzdGtleQ==" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.encryptionKey).toBe("dGVzdGtleQ==");
    });

    it("loads backy config when present", async () => {
      mockGetBackyConfig.mockResolvedValue({
        success: true,
        data: { webhookUrl: "https://backy.test/webhook/p1", maskedApiKey: "abc•••" },
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.backyWebhookUrl).toBe("https://backy.test/webhook/p1");
      expect(result.current.backyMaskedApiKey).toBe("abc•••");
    });

    it("loads pull webhook key when present", async () => {
      mockGetPullWebhook.mockResolvedValue({ success: true, data: "pull-key-123" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.backyPullKey).toBe("pull-key-123");
    });

    it("reflects encryption status from context", async () => {
      mockUseDashboardState.mockReturnValue({ encryptionEnabled: true });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.encryptionEnabled).toBe(true);
    });

    it("sets error when load fails", async () => {
      mockGetUserSettings.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.error).toBe("Failed to load settings");
    });
  });

  describe("handleUpdateTheme", () => {
    it("updates theme on success", async () => {
      const updatedSettings = { ...sampleSettings, theme: "dark" };
      mockUpdateUserSettings.mockResolvedValue({ success: true, data: updatedSettings });

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
      mockUpdateUserSettings.mockResolvedValue({ success: false, error: "Invalid theme" });

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
      mockUpdateUserSettings.mockResolvedValue({ success: true, data: updatedSettings });

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

  describe("encryption key management", () => {
    it("generates key and refreshes dashboard", async () => {
      mockGenerateAndSaveKey.mockResolvedValue({ success: true, data: "newKey123" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleGenerateKey();
      });

      expect(success!).toBe(true);
      expect(result.current.encryptionKey).toBe("newKey123");
      expect(result.current.keyRevealed).toBe(true);
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("sets error on generation failure", async () => {
      mockGenerateAndSaveKey.mockResolvedValue({ success: false, error: "DB error" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleGenerateKey();
      });

      expect(result.current.error).toBe("DB error");
    });

    it("toggles key reveal", async () => {
      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      expect(result.current.keyRevealed).toBe(false);

      act(() => {
        result.current.handleToggleKeyReveal();
      });
      expect(result.current.keyRevealed).toBe(true);

      act(() => {
        result.current.handleToggleKeyReveal();
      });
      expect(result.current.keyRevealed).toBe(false);
    });

    it("copies key to clipboard", async () => {
      mockGetEncryptionKey.mockResolvedValue({ success: true, data: "myKey" });

      // Mock clipboard
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleCopyKey();
      });

      expect(success!).toBe(true);
      expect(writeText).toHaveBeenCalledWith("myKey");
    });

    it("returns false when no key to copy", async () => {
      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleCopyKey();
      });

      expect(success!).toBe(false);
    });
  });

  describe("backy config", () => {
    it("saves backy config", async () => {
      mockSaveBackyConfig.mockResolvedValue({
        success: true,
        data: { webhookUrl: "https://backy.test/wh", maskedApiKey: "abc•••" },
      });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleSaveBackyConfig("https://backy.test/wh", "key123");
      });

      expect(success!).toBe(true);
      expect(result.current.backyWebhookUrl).toBe("https://backy.test/wh");
      expect(result.current.backyMaskedApiKey).toBe("abc•••");
    });

    it("sets error on save failure", async () => {
      mockSaveBackyConfig.mockResolvedValue({ success: false, error: "Invalid URL" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      await act(async () => {
        await result.current.handleSaveBackyConfig("bad", "key");
      });

      expect(result.current.error).toBe("Invalid URL");
    });

    it("tests connection successfully", async () => {
      mockTestBackyConnection.mockResolvedValue({ success: true, data: null });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleTestBackyConnection();
      });

      expect(success!).toBe(true);
    });

    it("tests connection failure", async () => {
      mockTestBackyConnection.mockResolvedValue({ success: false, error: "Connection failed (401)" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleTestBackyConnection();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Connection failed (401)");
    });
  });

  describe("pull webhook", () => {
    it("generates pull webhook key", async () => {
      mockGeneratePullWebhook.mockResolvedValue({ success: true, data: "pullkey123" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleGeneratePullWebhook();
      });

      expect(success!).toBe(true);
      expect(result.current.backyPullKey).toBe("pullkey123");
    });

    it("revokes pull webhook key", async () => {
      mockGetPullWebhook.mockResolvedValue({ success: true, data: "existing-key" });
      mockRevokePullWebhook.mockResolvedValue({ success: true, data: null });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});
      expect(result.current.backyPullKey).toBe("existing-key");

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRevokePullWebhook();
      });

      expect(success!).toBe(true);
      expect(result.current.backyPullKey).toBeNull();
    });

    it("sets error when generatePullWebhook throws", async () => {
      mockGeneratePullWebhook.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleGeneratePullWebhook();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Failed to generate pull webhook");
    });

    it("sets error when revokePullWebhook throws", async () => {
      mockRevokePullWebhook.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRevokePullWebhook();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Failed to revoke pull webhook");
    });

    it("sets error when generatePullWebhook returns failure", async () => {
      mockGeneratePullWebhook.mockResolvedValue({ success: false, error: "DB error" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleGeneratePullWebhook();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("DB error");
    });

    it("sets error when revokePullWebhook returns failure", async () => {
      mockRevokePullWebhook.mockResolvedValue({ success: false, error: "DB error" });

      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      let success: boolean;
      await act(async () => {
        success = await result.current.handleRevokePullWebhook();
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("DB error");
    });
  });

  describe("reload", () => {
    it("reloads all settings from server", async () => {
      const { result } = renderHook(() => useSettingsViewModel());
      await act(async () => {});

      const updatedSettings = { ...sampleSettings, theme: "dark" };
      mockGetUserSettings.mockResolvedValue({ success: true, data: updatedSettings });
      mockGetEncryptionKey.mockResolvedValue({ success: true, data: "reloadedKey" });

      await act(async () => {
        await result.current.reload();
      });

      expect(result.current.settings?.theme).toBe("dark");
      expect(result.current.encryptionKey).toBe("reloadedKey");
    });
  });

  describe("clearError", () => {
    it("clears error state", async () => {
      mockUpdateUserSettings.mockResolvedValue({ success: false, error: "some error" });

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
