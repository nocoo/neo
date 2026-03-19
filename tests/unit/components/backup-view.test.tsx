/**
 * BackupView component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockBackupVM, mockUseDashboardState } = vi.hoisted(() => {
  const mockBackupVM = {
    backups: [],
    backupCount: 0,
    lastBackupAt: null,
    busy: false,
    error: null,
    loadBackups: vi.fn(),
    handleCreateBackup: vi.fn(),
    handleCleanup: vi.fn(),
    clearError: vi.fn(),
  };

  const mockUseDashboardState = vi.fn();

  return { mockBackupVM, mockUseDashboardState };
});

vi.mock("@/viewmodels/useBackupViewModel", () => ({
  useBackupViewModel: () => mockBackupVM,
}));

vi.mock("@/contexts/dashboard-context", () => ({
  useDashboardState: mockUseDashboardState,
  useDashboardActions: vi.fn().mockReturnValue({}),
}));

import { BackupView } from "@/components/backup-view";
import type { Backup } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

const sampleBackup: Backup = {
  id: "bk_1",
  userId: "test-user",
  filename: "backup_20260319.json",
  data: "[]",
  secretCount: 5,
  encrypted: false,
  reason: "manual",
  hash: "abc",
  createdAt: new Date("2026-03-19T00:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockBackupVM.backups = [];
  mockBackupVM.backupCount = 0;
  mockBackupVM.lastBackupAt = null;
  mockBackupVM.busy = false;
  mockBackupVM.error = null;
  mockUseDashboardState.mockReturnValue({ secrets: [] });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("BackupView", () => {
  it("renders page header", () => {
    render(<BackupView />);
    expect(screen.getByText("Backups")).toBeDefined();
  });

  it("loads backups on mount", () => {
    render(<BackupView />);
    expect(mockBackupVM.loadBackups).toHaveBeenCalled();
  });

  it("shows empty state when no backups", () => {
    render(<BackupView />);
    expect(
      screen.getByText("No backups yet. Create your first backup to protect your secrets.")
    ).toBeDefined();
  });

  it("renders backup items", () => {
    mockBackupVM.backups = [sampleBackup];
    mockBackupVM.backupCount = 1;

    render(<BackupView />);
    expect(screen.getByText("backup_20260319.json")).toBeDefined();
    expect(screen.getByText(/5 secrets/)).toBeDefined();
  });

  it("shows backup count in header", () => {
    mockBackupVM.backupCount = 3;
    render(<BackupView />);
    expect(screen.getByText(/3 backups total/)).toBeDefined();
  });

  it("creates backup when button clicked", async () => {
    mockUseDashboardState.mockReturnValue({
      secrets: [{ id: "s1", name: "GitHub", account: "", secret: "KEY", type: "totp", digits: 6, period: 30, algorithm: "SHA-1", counter: 0 }],
    });
    mockBackupVM.handleCreateBackup.mockResolvedValue(true);

    render(<BackupView />);

    await act(async () => {
      fireEvent.click(screen.getByText("Create Backup"));
    });

    expect(mockBackupVM.handleCreateBackup).toHaveBeenCalled();
  });

  it("shows error banner", () => {
    mockBackupVM.error = "Something went wrong";
    render(<BackupView />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("dismisses error", () => {
    mockBackupVM.error = "Error";
    render(<BackupView />);

    fireEvent.click(screen.getByText("Dismiss"));
    expect(mockBackupVM.clearError).toHaveBeenCalled();
  });

  it("calls cleanup on button click", async () => {
    mockBackupVM.handleCleanup.mockResolvedValue({ deleted: 0 });
    render(<BackupView />);

    await act(async () => {
      fireEvent.click(screen.getByText("Cleanup"));
    });

    expect(mockBackupVM.handleCleanup).toHaveBeenCalled();
  });

  it("calls refresh on button click", () => {
    render(<BackupView />);

    fireEvent.click(screen.getByText("Refresh"));
    // loadBackups called once on mount + once on refresh
    expect(mockBackupVM.loadBackups).toHaveBeenCalledTimes(2);
  });
});
