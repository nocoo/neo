/**
 * ToolsView component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockDevToolsVM, mockSecretsVM } = vi.hoisted(() => {
  const mockDevToolsVM = {
    parsedSecrets: [],
    detectedFormat: null,
    exportOutput: "",
    otpTestResult: null,
    busy: false,
    error: null,
    handleParseImport: vi.fn(),
    handleExport: vi.fn(),
    handleTestOtp: vi.fn(),
    clearParsed: vi.fn(),
    clearExport: vi.fn(),
    clearError: vi.fn(),
  };

  const mockSecretsVM = {
    filteredSecrets: [],
    searchQuery: "",
    otpMap: new Map(),
    busy: false,
    error: null,
    setSearchQuery: vi.fn(),
    handleCreate: vi.fn(),
    handleUpdate: vi.fn(),
    handleDelete: vi.fn(),
    handleBatchImport: vi.fn(),
    refreshOtp: vi.fn(),
    clearError: vi.fn(),
  };

  return { mockDevToolsVM, mockSecretsVM };
});

vi.mock("@/viewmodels/useDevToolsViewModel", () => ({
  useDevToolsViewModel: () => mockDevToolsVM,
}));

vi.mock("@/viewmodels/useSecretsViewModel", () => ({
  useSecretsViewModel: () => mockSecretsVM,
}));

import { ToolsView } from "@/components/tools-view";

beforeEach(() => {
  vi.clearAllMocks();
  mockDevToolsVM.parsedSecrets = [];
  mockDevToolsVM.detectedFormat = null;
  mockDevToolsVM.exportOutput = "";
  mockDevToolsVM.otpTestResult = null;
  mockDevToolsVM.busy = false;
  mockDevToolsVM.error = null;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("ToolsView", () => {
  it("renders tool cards", () => {
    render(<ToolsView />);
    expect(screen.getByText("Import")).toBeDefined();
    expect(screen.getByText("Export")).toBeDefined();
    expect(screen.getByText("OTP Tester")).toBeDefined();
  });

  it("opens import dialog", () => {
    render(<ToolsView />);
    fireEvent.click(screen.getByText("Open Import Tool"));
    expect(screen.getByText("Import Secrets")).toBeDefined();
  });

  it("opens export dialog", () => {
    render(<ToolsView />);
    fireEvent.click(screen.getByText("Open Export Tool"));
    expect(screen.getByText("Export Secrets")).toBeDefined();
  });

  it("generates test OTP", async () => {
    mockDevToolsVM.handleTestOtp.mockResolvedValue(undefined);

    render(<ToolsView />);

    fireEvent.change(screen.getByLabelText("Test secret key"), {
      target: { value: "JBSWY3DPEHPK3PXP" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Generate Test OTP"));
    });

    expect(mockDevToolsVM.handleTestOtp).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP", {
      digits: 6,
      period: 30,
    });
  });

  it("shows OTP test result", () => {
    mockDevToolsVM.otpTestResult = "654321";
    render(<ToolsView />);
    expect(screen.getByTestId("otp-test-result").textContent).toBe("654321");
  });

  it("shows error banner", () => {
    mockDevToolsVM.error = "Invalid Base32";
    render(<ToolsView />);
    expect(screen.getByText("Invalid Base32")).toBeDefined();
  });

  it("dismisses error", () => {
    mockDevToolsVM.error = "Error";
    render(<ToolsView />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(mockDevToolsVM.clearError).toHaveBeenCalled();
  });

  it("disables generate button when secret is empty", () => {
    render(<ToolsView />);
    const btn = screen.getByText("Generate Test OTP");
    expect(btn.closest("button")?.disabled).toBe(true);
  });

  it("allows custom digits and period", async () => {
    mockDevToolsVM.handleTestOtp.mockResolvedValue(undefined);

    render(<ToolsView />);

    fireEvent.change(screen.getByLabelText("Test secret key"), {
      target: { value: "JBSWY3DPEHPK3PXP" },
    });
    fireEvent.change(screen.getByLabelText("Digits"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Period"), {
      target: { value: "60" },
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Generate Test OTP"));
    });

    expect(mockDevToolsVM.handleTestOtp).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP", {
      digits: 8,
      period: 60,
    });
  });
});
