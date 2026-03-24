/**
 * SecretsView wiring tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Secret, OtpResult } from "@/models/types";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockSecretsVM, mockDevToolsVM } = vi.hoisted(() => {
  const mockSecretsVM = {
    filteredSecrets: [] as Secret[],
    searchQuery: "",
    otpMap: new Map<string, OtpResult>(),
    busy: false,
    error: null as string | null,
    setSearchQuery: vi.fn(),
    handleCreate: vi.fn(),
    handleUpdate: vi.fn(),
    handleDelete: vi.fn(),
    handleBatchImport: vi.fn(),
    refreshOtp: vi.fn(),
    clearError: vi.fn(),
  };

  const mockDevToolsVM = {
    parsedSecrets: [],
    detectedFormat: null,
    exportOutput: "",
    otpTestResult: null as string | null,
    busy: false,
    error: null as string | null,
    handleParseImport: vi.fn(),
    handleExport: vi.fn(),
    handleTestOtp: vi.fn(),
    clearParsed: vi.fn(),
    clearExport: vi.fn(),
    clearError: vi.fn(),
  };

  return { mockSecretsVM, mockDevToolsVM };
});

vi.mock("@/viewmodels/useSecretsViewModel", () => ({
  useSecretsViewModel: () => mockSecretsVM,
}));

vi.mock("@/viewmodels/useDevToolsViewModel", () => ({
  useDevToolsViewModel: () => mockDevToolsVM,
}));

import { SecretsView } from "@/components/secrets-view";

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
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSecretsVM.filteredSecrets = [];
  mockSecretsVM.searchQuery = "";
  mockSecretsVM.otpMap = new Map();
  mockSecretsVM.busy = false;
  mockSecretsVM.error = null;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("SecretsView", () => {
  it("renders search bar and icon-only action buttons", () => {
    render(<SecretsView />);
    expect(screen.getByLabelText("Search secrets")).toBeDefined();
    expect(screen.getByTitle("Import")).toBeDefined();
    expect(screen.getByTitle("Export")).toBeDefined();
    expect(screen.getByTitle("Add secret")).toBeDefined();
  });

  it("renders action buttons as icon-only", () => {
    render(<SecretsView />);
    // Buttons should NOT have text labels
    expect(screen.queryByText("Import")).toBeNull();
    expect(screen.queryByText("Export")).toBeNull();
    expect(screen.queryByText("Add Secret")).toBeNull();
  });

  it("renders empty state when no secrets", () => {
    render(<SecretsView />);
    expect(
      screen.getByText("No secrets yet. Add your first secret to get started.")
    ).toBeDefined();
  });

  it("renders secrets from viewmodel", () => {
    mockSecretsVM.filteredSecrets = [sampleSecret];
    mockSecretsVM.otpMap = new Map([
      ["s_test_1", { otp: "123456", remainingSeconds: 20, period: 30 }],
    ]);

    render(<SecretsView />);
    expect(screen.getByText("GitHub")).toBeDefined();
    expect(screen.getByText("123456")).toBeDefined();
  });

  it("shows error banner when error exists", () => {
    mockSecretsVM.error = "Something went wrong";
    render(<SecretsView />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("dismisses error when dismiss clicked", () => {
    mockSecretsVM.error = "Error message";
    render(<SecretsView />);

    fireEvent.click(screen.getByText("Dismiss"));
    expect(mockSecretsVM.clearError).toHaveBeenCalled();
  });

  it("opens create dialog when Add secret clicked", () => {
    render(<SecretsView />);

    fireEvent.click(screen.getByTitle("Add secret"));
    // Dialog opens — check for form field that only exists in the dialog
    expect(screen.getByLabelText("Name *")).toBeDefined();
  });

  it("opens import dialog when Import clicked", () => {
    render(<SecretsView />);

    fireEvent.click(screen.getByTitle("Import"));
    expect(screen.getByText("Import Secrets")).toBeDefined();
  });

  it("opens export dialog when Export clicked", () => {
    render(<SecretsView />);

    fireEvent.click(screen.getByTitle("Export"));
    expect(screen.getByText("Export Secrets")).toBeDefined();
  });
});
