/**
 * Developer Tools ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockDetectImportFormat,
  mockParseImport,
  mockExportSecrets,
  mockGenerateTOTP,
  mockValidateBase32,
  mockUseDashboardState,
} = vi.hoisted(() => {
  return {
    mockDetectImportFormat: vi.fn(),
    mockParseImport: vi.fn(),
    mockExportSecrets: vi.fn(),
    mockGenerateTOTP: vi.fn(),
    mockValidateBase32: vi.fn(),
    mockUseDashboardState: vi.fn(),
  };
});

vi.mock("@/models/import-parsers", () => ({
  detectImportFormat: mockDetectImportFormat,
  parseImport: mockParseImport,
}));

vi.mock("@/models/export-formatters", () => ({
  exportSecrets: mockExportSecrets,
}));

vi.mock("@/models/otp", () => ({
  generateTOTP: mockGenerateTOTP,
}));

vi.mock("@/models/validation", () => ({
  validateBase32: mockValidateBase32,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardState: mockUseDashboardState,
  useDashboardActions: vi.fn().mockReturnValue({}),
}));

import { useDevToolsViewModel } from "@/viewmodels/useDevToolsViewModel";
import type { Secret, ParsedSecret } from "@/models/types";

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
  color: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleParsed: ParsedSecret = {
  name: "GitHub",
  account: "user@example.com",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 6,
  period: 30,
  algorithm: "SHA-1",
  counter: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseDashboardState.mockReturnValue({
    secrets: [sampleSecret],
    loading: false,
  });
  mockValidateBase32.mockReturnValue({ valid: true });
  mockGenerateTOTP.mockResolvedValue("123456");
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("useDevToolsViewModel", () => {
  describe("initial state", () => {
    it("starts with empty parsed secrets", () => {
      const { result } = renderHook(() => useDevToolsViewModel());
      expect(result.current.parsedSecrets).toHaveLength(0);
    });

    it("starts with no detected format", () => {
      const { result } = renderHook(() => useDevToolsViewModel());
      expect(result.current.detectedFormat).toBeNull();
    });

    it("starts with empty export output", () => {
      const { result } = renderHook(() => useDevToolsViewModel());
      expect(result.current.exportOutput).toBe("");
    });

    it("starts with no OTP test result", () => {
      const { result } = renderHook(() => useDevToolsViewModel());
      expect(result.current.otpTestResult).toBeNull();
    });
  });

  describe("handleParseImport", () => {
    it("auto-detects format and parses secrets", () => {
      mockDetectImportFormat.mockReturnValue("aegis");
      mockParseImport.mockReturnValue([sampleParsed]);

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport('{"version":1}');
      });

      expect(result.current.detectedFormat).toBe("aegis");
      expect(result.current.parsedSecrets).toHaveLength(1);
      expect(result.current.parsedSecrets[0].name).toBe("GitHub");
    });

    it("uses explicit format when provided", () => {
      mockParseImport.mockReturnValue([sampleParsed]);

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport("some data", "2fas");
      });

      expect(result.current.detectedFormat).toBe("2fas");
      expect(mockDetectImportFormat).not.toHaveBeenCalled();
    });

    it("sets error when format not detected", () => {
      mockDetectImportFormat.mockReturnValue(null);

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport("random gibberish");
      });

      expect(result.current.error).toBe("Unable to detect import format");
      expect(result.current.parsedSecrets).toHaveLength(0);
    });

    it("sets error when no secrets found", () => {
      mockDetectImportFormat.mockReturnValue("aegis");
      mockParseImport.mockReturnValue([]);

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport("{}");
      });

      expect(result.current.error).toBe("No secrets found in imported data");
    });

    it("sets error on parse exception", () => {
      mockDetectImportFormat.mockImplementation(() => {
        throw new Error("parse fail");
      });

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport("bad data");
      });

      expect(result.current.error).toBe("Failed to parse import data");
      expect(result.current.parsedSecrets).toHaveLength(0);
    });
  });

  describe("handleExport", () => {
    it("exports secrets in given format", () => {
      mockExportSecrets.mockReturnValue("exported-data");

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleExport("aegis");
      });

      expect(mockExportSecrets).toHaveBeenCalledWith(
        [expect.objectContaining({ name: "GitHub", account: "user@example.com" })],
        "aegis"
      );
      expect(result.current.exportOutput).toBe("exported-data");
    });

    it("converts Secret to ParsedSecret correctly", () => {
      mockExportSecrets.mockReturnValue("");

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleExport("otpauth-uri");
      });

      expect(mockExportSecrets).toHaveBeenCalledWith(
        [
          {
            name: "GitHub",
            account: "user@example.com",
            secret: "JBSWY3DPEHPK3PXP",
            type: "totp",
            digits: 6,
            period: 30,
            algorithm: "SHA-1",
            counter: 0,
          },
        ],
        "otpauth-uri"
      );
    });

    it("sets error on export exception", () => {
      mockExportSecrets.mockImplementation(() => {
        throw new Error("export fail");
      });

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleExport("aegis");
      });

      expect(result.current.error).toBe("Failed to export secrets");
      expect(result.current.exportOutput).toBe("");
    });
  });

  describe("handleTestOtp", () => {
    it("generates OTP for valid secret", async () => {
      mockGenerateTOTP.mockResolvedValue("654321");

      const { result } = renderHook(() => useDevToolsViewModel());

      await act(async () => {
        await result.current.handleTestOtp("JBSWY3DPEHPK3PXP");
      });

      expect(result.current.otpTestResult).toBe("654321");
      expect(mockGenerateTOTP).toHaveBeenCalled();
    });

    it("passes custom options to OTP generator", async () => {
      mockGenerateTOTP.mockResolvedValue("12345678");

      const { result } = renderHook(() => useDevToolsViewModel());

      await act(async () => {
        await result.current.handleTestOtp("JBSWY3DPEHPK3PXP", {
          digits: 8,
          period: 60,
          algorithm: "SHA-256",
        });
      });

      expect(mockGenerateTOTP).toHaveBeenCalledWith(
        "JBSWY3DPEHPK3PXP",
        expect.any(Number),
        expect.objectContaining({ digits: 8, period: 60, algorithm: "SHA-256" })
      );
    });

    it("sets error for invalid base32", async () => {
      mockValidateBase32.mockReturnValue({ valid: false, error: "bad chars" });

      const { result } = renderHook(() => useDevToolsViewModel());

      await act(async () => {
        await result.current.handleTestOtp("!!!invalid!!!");
      });

      expect(result.current.error).toBe("Invalid Base32 secret");
      expect(result.current.otpTestResult).toBeNull();
    });

    it("sets error on generation failure", async () => {
      mockGenerateTOTP.mockRejectedValue(new Error("crypto fail"));

      const { result } = renderHook(() => useDevToolsViewModel());

      await act(async () => {
        await result.current.handleTestOtp("JBSWY3DPEHPK3PXP");
      });

      expect(result.current.error).toBe("Failed to generate test OTP");
      expect(result.current.otpTestResult).toBeNull();
    });
  });

  describe("clear actions", () => {
    it("clearParsed resets parsed secrets and format", () => {
      mockDetectImportFormat.mockReturnValue("aegis");
      mockParseImport.mockReturnValue([sampleParsed]);

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport("data");
      });
      expect(result.current.parsedSecrets).toHaveLength(1);

      act(() => {
        result.current.clearParsed();
      });
      expect(result.current.parsedSecrets).toHaveLength(0);
      expect(result.current.detectedFormat).toBeNull();
    });

    it("clearExport resets export output", () => {
      mockExportSecrets.mockReturnValue("data");

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleExport("aegis");
      });
      expect(result.current.exportOutput).toBe("data");

      act(() => {
        result.current.clearExport();
      });
      expect(result.current.exportOutput).toBe("");
    });

    it("clearError resets error", () => {
      mockDetectImportFormat.mockReturnValue(null);

      const { result } = renderHook(() => useDevToolsViewModel());

      act(() => {
        result.current.handleParseImport("bad");
      });
      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });
});
