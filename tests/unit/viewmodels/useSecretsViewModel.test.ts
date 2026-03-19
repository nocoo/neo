/**
 * Secrets ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockCreateSecret,
  mockUpdateSecret,
  mockDeleteSecret,
  mockBatchImport,
  mockGetSecrets,
  mockGenerateTOTP,
  mockUseDashboardState,
  mockHandleSecretCreated,
  mockHandleSecretDeleted,
  mockHandleSecretUpdated,
  mockHandleSecretsReloaded,
} = vi.hoisted(() => {
  const mockCreateSecret = vi.fn();
  const mockUpdateSecret = vi.fn();
  const mockDeleteSecret = vi.fn();
  const mockBatchImport = vi.fn();
  const mockGetSecrets = vi.fn();
  const mockGenerateTOTP = vi.fn();

  const mockHandleSecretCreated = vi.fn();
  const mockHandleSecretDeleted = vi.fn();
  const mockHandleSecretUpdated = vi.fn();
  const mockHandleSecretsReloaded = vi.fn();

  const mockUseDashboardState = vi.fn();

  return {
    mockCreateSecret,
    mockUpdateSecret,
    mockDeleteSecret,
    mockBatchImport,
    mockGetSecrets,
    mockGenerateTOTP,
    mockUseDashboardState,
    mockHandleSecretCreated,
    mockHandleSecretDeleted,
    mockHandleSecretUpdated,
    mockHandleSecretsReloaded,
  };
});

vi.mock("@/actions/secrets", () => ({
  createSecret: mockCreateSecret,
  updateSecret: mockUpdateSecret,
  deleteSecret: mockDeleteSecret,
  batchImportSecrets: mockBatchImport,
  getSecrets: mockGetSecrets,
}));

vi.mock("@/models/otp", () => ({
  generateTOTP: mockGenerateTOTP,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardState: mockUseDashboardState,
  useDashboardActions: vi.fn().mockReturnValue({
    handleSecretCreated: mockHandleSecretCreated,
    handleSecretDeleted: mockHandleSecretDeleted,
    handleSecretUpdated: mockHandleSecretUpdated,
    handleSecretsReloaded: mockHandleSecretsReloaded,
  }),
}));

import { useSecretsViewModel } from "@/viewmodels/useSecretsViewModel";
import type { Secret } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const sampleSecret: Secret = {
  id: "s_test_1",
  userId: "test-user",
  name: "GitHub",
  account: "user@example.com",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  algorithm: "SHA-1",
  counter: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleSecret2: Secret = {
  ...sampleSecret,
  id: "s_test_2",
  name: "GitLab",
  account: "admin@gitlab.com",
};

function setupMocks(secrets: Secret[] = [sampleSecret]) {
  mockUseDashboardState.mockReturnValue({
    secrets,
    loading: false,
  });
  mockGenerateTOTP.mockResolvedValue("123456");
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  setupMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// Need to import afterEach
import { afterEach } from "vitest";

describe("useSecretsViewModel", () => {
  describe("initial state", () => {
    it("returns secrets from dashboard state", async () => {
      const { result } = renderHook(() => useSecretsViewModel());

      expect(result.current.filteredSecrets).toHaveLength(1);
      expect(result.current.filteredSecrets[0].name).toBe("GitHub");
    });

    it("starts with empty search query", () => {
      const { result } = renderHook(() => useSecretsViewModel());
      expect(result.current.searchQuery).toBe("");
    });

    it("starts with no error", () => {
      const { result } = renderHook(() => useSecretsViewModel());
      expect(result.current.error).toBeNull();
    });

    it("starts not busy", () => {
      const { result } = renderHook(() => useSecretsViewModel());
      expect(result.current.busy).toBe(false);
    });
  });

  describe("search filtering", () => {
    it("filters secrets by name", () => {
      setupMocks([sampleSecret, sampleSecret2]);
      const { result } = renderHook(() => useSecretsViewModel());

      act(() => {
        result.current.setSearchQuery("github");
      });

      expect(result.current.filteredSecrets).toHaveLength(1);
      expect(result.current.filteredSecrets[0].name).toBe("GitHub");
    });

    it("filters secrets by account", () => {
      setupMocks([sampleSecret, sampleSecret2]);
      const { result } = renderHook(() => useSecretsViewModel());

      act(() => {
        result.current.setSearchQuery("admin@gitlab");
      });

      expect(result.current.filteredSecrets).toHaveLength(1);
      expect(result.current.filteredSecrets[0].name).toBe("GitLab");
    });

    it("returns all secrets when query is empty", () => {
      setupMocks([sampleSecret, sampleSecret2]);
      const { result } = renderHook(() => useSecretsViewModel());

      act(() => {
        result.current.setSearchQuery("github");
      });
      expect(result.current.filteredSecrets).toHaveLength(1);

      act(() => {
        result.current.setSearchQuery("");
      });
      expect(result.current.filteredSecrets).toHaveLength(2);
    });

    it("returns all secrets when query is whitespace only", () => {
      setupMocks([sampleSecret, sampleSecret2]);
      const { result } = renderHook(() => useSecretsViewModel());

      act(() => {
        result.current.setSearchQuery("   ");
      });

      expect(result.current.filteredSecrets).toHaveLength(2);
    });

    it("is case insensitive", () => {
      setupMocks([sampleSecret]);
      const { result } = renderHook(() => useSecretsViewModel());

      act(() => {
        result.current.setSearchQuery("GITHUB");
      });

      expect(result.current.filteredSecrets).toHaveLength(1);
    });
  });

  describe("OTP generation", () => {
    it("generates OTPs for totp secrets", async () => {
      mockGenerateTOTP.mockResolvedValue("654321");
      const { result } = renderHook(() => useSecretsViewModel());

      // Flush the async OTP generation
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(mockGenerateTOTP).toHaveBeenCalled();
      expect(result.current.otpMap.size).toBe(1);
      expect(result.current.otpMap.get("s_test_1")?.otp).toBe("654321");
    });

    it("skips non-totp secrets", async () => {
      const hotpSecret: Secret = { ...sampleSecret, id: "s_hotp", type: "hotp" };
      setupMocks([hotpSecret]);
      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.otpMap.size).toBe(0);
    });

    it("handles OTP generation failure gracefully", async () => {
      mockGenerateTOTP.mockRejectedValue(new Error("crypto error"));
      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      expect(result.current.otpMap.size).toBe(0);
    });

    it("auto-refreshes OTPs on interval", async () => {
      renderHook(() => useSecretsViewModel());

      // Initial generation
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const initialCallCount = mockGenerateTOTP.mock.calls.length;

      // Advance by 1 second to trigger interval
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });

      expect(mockGenerateTOTP.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it("includes remaining seconds in OTP result", async () => {
      mockGenerateTOTP.mockResolvedValue("111111");
      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const otpResult = result.current.otpMap.get("s_test_1");
      expect(otpResult).toBeDefined();
      expect(otpResult!.remainingSeconds).toBeGreaterThan(0);
      expect(otpResult!.remainingSeconds).toBeLessThanOrEqual(30);
      expect(otpResult!.period).toBe(30);
    });

    it("refreshes single OTP via refreshOtp", async () => {
      mockGenerateTOTP.mockResolvedValue("999999");
      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      mockGenerateTOTP.mockResolvedValue("888888");

      await act(async () => {
        await result.current.refreshOtp("s_test_1");
      });

      expect(result.current.otpMap.get("s_test_1")?.otp).toBe("888888");
    });

    it("refreshOtp does nothing for non-existent secret", async () => {
      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      const mapBefore = result.current.otpMap;

      await act(async () => {
        await result.current.refreshOtp("nonexistent");
      });

      // Map should not have changed structure
      expect(result.current.otpMap.size).toBe(mapBefore.size);
    });
  });

  describe("handleCreate", () => {
    it("creates secret and syncs context on success", async () => {
      const newSecret = { ...sampleSecret, id: "s_new" };
      mockCreateSecret.mockResolvedValue({ success: true, data: newSecret });

      const { result } = renderHook(() => useSecretsViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.handleCreate({
          name: "GitHub",
          secret: "JBSWY3DPEHPK3PXP",
        });
      });

      expect(success!).toBe(true);
      expect(mockCreateSecret).toHaveBeenCalledWith({
        name: "GitHub",
        secret: "JBSWY3DPEHPK3PXP",
      });
      expect(mockHandleSecretCreated).toHaveBeenCalledWith(newSecret);
      expect(result.current.busy).toBe(false);
    });

    it("sets error on failure response", async () => {
      mockCreateSecret.mockResolvedValue({ success: false, error: "Duplicate name" });

      const { result } = renderHook(() => useSecretsViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.handleCreate({
          name: "GitHub",
          secret: "JBSWY3DPEHPK3PXP",
        });
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Duplicate name");
      expect(mockHandleSecretCreated).not.toHaveBeenCalled();
    });

    it("sets generic error on exception", async () => {
      mockCreateSecret.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useSecretsViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.handleCreate({
          name: "GitHub",
          secret: "JBSWY3DPEHPK3PXP",
        });
      });

      expect(success!).toBe(false);
      expect(result.current.error).toBe("Failed to create secret");
    });
  });

  describe("handleUpdate", () => {
    it("updates secret and syncs context on success", async () => {
      const updated = { ...sampleSecret, name: "GitHub Enterprise" };
      mockUpdateSecret.mockResolvedValue({ success: true, data: updated });

      const { result } = renderHook(() => useSecretsViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.handleUpdate({
          id: "s_test_1",
          name: "GitHub Enterprise",
        });
      });

      expect(success!).toBe(true);
      expect(mockHandleSecretUpdated).toHaveBeenCalledWith(updated);
    });

    it("sets error on failure", async () => {
      mockUpdateSecret.mockResolvedValue({ success: false, error: "Not found" });

      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await result.current.handleUpdate({ id: "s_test_1", name: "New" });
      });

      expect(result.current.error).toBe("Not found");
    });

    it("sets generic error on exception", async () => {
      mockUpdateSecret.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await result.current.handleUpdate({ id: "s_test_1", name: "New" });
      });

      expect(result.current.error).toBe("Failed to update secret");
    });
  });

  describe("handleDelete", () => {
    it("deletes secret and syncs context on success", async () => {
      mockDeleteSecret.mockResolvedValue({ success: true, data: undefined });

      const { result } = renderHook(() => useSecretsViewModel());

      let success: boolean;
      await act(async () => {
        success = await result.current.handleDelete("s_test_1");
      });

      expect(success!).toBe(true);
      expect(mockDeleteSecret).toHaveBeenCalledWith("s_test_1");
      expect(mockHandleSecretDeleted).toHaveBeenCalledWith("s_test_1");
    });

    it("sets error on failure", async () => {
      mockDeleteSecret.mockResolvedValue({ success: false, error: "Not found" });

      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await result.current.handleDelete("s_test_1");
      });

      expect(result.current.error).toBe("Not found");
    });

    it("sets generic error on exception", async () => {
      mockDeleteSecret.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await result.current.handleDelete("s_test_1");
      });

      expect(result.current.error).toBe("Failed to delete secret");
    });
  });

  describe("handleBatchImport", () => {
    it("imports and reloads secrets on success", async () => {
      mockBatchImport.mockResolvedValue({
        success: true,
        data: { imported: 3, skipped: 1 },
      });
      mockGetSecrets.mockResolvedValue({
        success: true,
        data: [sampleSecret, sampleSecret2],
      });

      const { result } = renderHook(() => useSecretsViewModel());

      let importResult: { imported: number; skipped: number } | null;
      await act(async () => {
        importResult = await result.current.handleBatchImport([
          { name: "A", secret: "AAAA" },
          { name: "B", secret: "BBBB" },
        ]);
      });

      expect(importResult!).toEqual({ imported: 3, skipped: 1 });
      expect(mockHandleSecretsReloaded).toHaveBeenCalledWith([sampleSecret, sampleSecret2]);
    });

    it("sets error on failure", async () => {
      mockBatchImport.mockResolvedValue({
        success: false,
        error: "Too many secrets",
      });

      const { result } = renderHook(() => useSecretsViewModel());

      let importResult: { imported: number; skipped: number } | null;
      await act(async () => {
        importResult = await result.current.handleBatchImport([]);
      });

      expect(importResult!).toBeNull();
      expect(result.current.error).toBe("Too many secrets");
    });

    it("sets generic error on exception", async () => {
      mockBatchImport.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await result.current.handleBatchImport([]);
      });

      expect(result.current.error).toBe("Failed to import secrets");
    });
  });

  describe("clearError", () => {
    it("clears error state", async () => {
      mockCreateSecret.mockResolvedValue({ success: false, error: "some error" });

      const { result } = renderHook(() => useSecretsViewModel());

      await act(async () => {
        await result.current.handleCreate({ name: "X", secret: "Y" });
      });
      expect(result.current.error).toBe("some error");

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe("busy state", () => {
    it("sets busy during create operation", async () => {
      let resolveFn: (value: unknown) => void;
      const pendingPromise = new Promise((resolve) => {
        resolveFn = resolve;
      });
      mockCreateSecret.mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useSecretsViewModel());

      // Start the create — don't await
      let createPromise: Promise<boolean>;
      act(() => {
        createPromise = result.current.handleCreate({ name: "X", secret: "Y" });
      });

      expect(result.current.busy).toBe(true);

      // Resolve and await
      await act(async () => {
        resolveFn!({ success: true, data: sampleSecret });
        await createPromise;
      });

      expect(result.current.busy).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("clears interval on unmount", async () => {
      const clearIntervalSpy = vi.spyOn(global, "clearInterval");

      const { unmount } = renderHook(() => useSecretsViewModel());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });
  });
});
