/**
 * BackupView component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockBackupVM, mockUseDashboardState } = vi.hoisted(() => {
  const mockBackupVM = {
    backups: [],
    busy: false,
    error: null,
    loadBackups: vi.fn(),
    handleCreateBackup: vi.fn(),
    handleRestore: vi.fn(),
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
  mockBackupVM.busy = false;
  mockBackupVM.error = null;
  mockUseDashboardState.mockReturnValue({ secrets: [], encryptionEnabled: false });
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

    render(<BackupView />);
    expect(screen.getByText("backup_20260319.json")).toBeDefined();
    expect(screen.getByText(/5 secrets/)).toBeDefined();
  });

  it("shows backup count in header", () => {
    mockBackupVM.backups = [sampleBackup, { ...sampleBackup, id: "bk_2" }, { ...sampleBackup, id: "bk_3" }];
    render(<BackupView />);
    expect(screen.getByText(/3 backups loaded/)).toBeDefined();
  });

  it("creates backup when button clicked", async () => {
    mockUseDashboardState.mockReturnValue({
      secrets: [{ id: "s1", name: "GitHub", account: "", secret: "KEY", type: "totp", digits: 6, period: 30, algorithm: "SHA-1", counter: 0, color: null }],
      encryptionEnabled: false,
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

  it("triggers download when download button clicked", () => {
    mockBackupVM.backups = [sampleBackup];

    // Spy on URL.createObjectURL and URL.revokeObjectURL
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;

    render(<BackupView />);

    fireEvent.click(screen.getByLabelText("Download backup_20260319.json"));

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("renders restore button for each backup", () => {
    mockBackupVM.backups = [sampleBackup];

    render(<BackupView />);

    expect(screen.getByLabelText("Restore backup_20260319.json")).toBeDefined();
  });

  it("calls handleRestore when restore button clicked", async () => {
    mockBackupVM.backups = [sampleBackup];
    mockBackupVM.handleRestore.mockResolvedValue({ imported: 0, skipped: 0, duplicates: 0 });

    render(<BackupView />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Restore backup_20260319.json"));
    });

    expect(mockBackupVM.handleRestore).toHaveBeenCalledWith("[]");
  });

  it("renders upload restore button", () => {
    render(<BackupView />);
    expect(screen.getByText("Upload Restore")).toBeDefined();
  });

  // ── Migration banner ──────────────────────────────────────────────────

  it("shows migration banner when plain-text backups exist", () => {
    mockBackupVM.backups = [sampleBackup];
    render(<BackupView />);
    expect(screen.getByTestId("migration-banner")).toBeDefined();
    expect(screen.getByText(/1 backup in the old format/)).toBeDefined();
  });

  it("does not show migration banner when no backups", () => {
    render(<BackupView />);
    expect(screen.queryByTestId("migration-banner")).toBeNull();
  });

  it("does not show migration banner when all backups are encrypted", () => {
    mockBackupVM.backups = [{ ...sampleBackup, encrypted: true }];
    render(<BackupView />);
    expect(screen.queryByTestId("migration-banner")).toBeNull();
  });

  it("shows export link enabled when encryption is configured", () => {
    mockBackupVM.backups = [sampleBackup];
    mockUseDashboardState.mockReturnValue({ secrets: [], encryptionEnabled: true });
    render(<BackupView />);
    const link = screen.getByTestId("migration-export-link");
    expect(link.getAttribute("aria-disabled")).toBe("false");
  });

  it("shows export link disabled when no encryption key", () => {
    mockBackupVM.backups = [sampleBackup];
    render(<BackupView />);
    const link = screen.getByTestId("migration-export-link");
    expect(link.getAttribute("aria-disabled")).toBe("true");
  });

  it("shows setup-first message when encryption not enabled", () => {
    mockBackupVM.backups = [sampleBackup];
    render(<BackupView />);
    expect(screen.getByText(/set up your encryption key in Settings/i)).toBeDefined();
  });

  it("shows export message when encryption is enabled", () => {
    mockBackupVM.backups = [sampleBackup];
    mockUseDashboardState.mockReturnValue({ secrets: [], encryptionEnabled: true });
    render(<BackupView />);
    expect(screen.getByText(/Export them as encrypted archives/)).toBeDefined();
  });
});
