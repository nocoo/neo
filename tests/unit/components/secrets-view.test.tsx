/**
 * SecretsView wiring tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockSecretsVM, mockDevToolsVM } = vi.hoisted(() => {
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

  return { mockSecretsVM, mockDevToolsVM };
});

vi.mock("@/viewmodels/useSecretsViewModel", () => ({
  useSecretsViewModel: () => mockSecretsVM,
}));

vi.mock("@/viewmodels/useDevToolsViewModel", () => ({
  useDevToolsViewModel: () => mockDevToolsVM,
}));

import { SecretsView } from "@/components/secrets-view";
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
  it("renders page header", () => {
    render(<SecretsView />);
    expect(screen.getByText("Secrets")).toBeDefined();
    expect(screen.getByText("Manage your 2FA secrets")).toBeDefined();
  });

  it("renders action buttons", () => {
    render(<SecretsView />);
    expect(screen.getByText("Import")).toBeDefined();
    expect(screen.getByText("Export")).toBeDefined();
    expect(screen.getByText("Add Secret")).toBeDefined();
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

  it("opens create dialog when Add Secret clicked", () => {
    render(<SecretsView />);

    fireEvent.click(screen.getByText("Add Secret"));
    // Dialog opens — check for form field that only exists in the dialog
    expect(screen.getByLabelText("Name *")).toBeDefined();
  });

  it("opens import dialog when Import clicked", () => {
    render(<SecretsView />);

    fireEvent.click(screen.getByText("Import"));
    expect(screen.getByText("Import Secrets")).toBeDefined();
  });

  it("opens export dialog when Export clicked", () => {
    render(<SecretsView />);

    fireEvent.click(screen.getByText("Export"));
    expect(screen.getByText("Export Secrets")).toBeDefined();
  });
});
