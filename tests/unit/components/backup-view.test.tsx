/**
 * BackupView component tests.
 *
 * Tests the new archive-based backup flow: download, push to Backy, restore.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockBackupVM, mockUseDashboardState } = vi.hoisted(() => {
  const mockBackupVM = {
    busy: false,
    error: null as string | null,
    lastPushResult: null as unknown,
    history: null as unknown,
    lastRestoreResult: null as unknown,
    legacyBackupCount: 0,
    handleDownloadArchive: vi.fn().mockResolvedValue(undefined),
    handlePushToBacky: vi.fn().mockResolvedValue(true),
    handleRestore: vi.fn().mockResolvedValue(true),
    refreshHistory: vi.fn().mockResolvedValue(undefined),
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

beforeEach(() => {
  vi.clearAllMocks();
  mockBackupVM.busy = false;
  mockBackupVM.error = null;
  mockBackupVM.lastPushResult = null;
  mockBackupVM.history = null;
  mockBackupVM.lastRestoreResult = null;
  mockBackupVM.legacyBackupCount = 0;
  mockUseDashboardState.mockReturnValue({ encryptionEnabled: true });
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("BackupView", () => {
  // ── Basic rendering ──────────────────────────────────────────────────

  it("renders page header", () => {
    render(<BackupView />);
    expect(screen.getByText("Backups")).toBeDefined();
  });

  it("renders all three sections", () => {
    render(<BackupView />);
    expect(screen.getByText("Create & Download")).toBeDefined();
    expect(screen.getByText("Push to Backy")).toBeDefined();
    expect(screen.getByText("Restore from Backup")).toBeDefined();
  });

  // ── Encryption warning ───────────────────────────────────────────────

  it("shows encryption warning when key not configured", () => {
    mockUseDashboardState.mockReturnValue({ encryptionEnabled: false });
    render(<BackupView />);
    expect(screen.getByTestId("encryption-warning")).toBeDefined();
    expect(screen.getByText(/Encryption key required/)).toBeDefined();
  });

  it("does not show encryption warning when key is configured", () => {
    render(<BackupView />);
    expect(screen.queryByTestId("encryption-warning")).toBeNull();
  });

  // ── Download ─────────────────────────────────────────────────────────

  it("calls handleDownloadArchive on download button click", async () => {
    render(<BackupView />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("download-archive-btn"));
    });

    expect(mockBackupVM.handleDownloadArchive).toHaveBeenCalled();
  });

  it("disables download button when encryption not enabled", () => {
    mockUseDashboardState.mockReturnValue({ encryptionEnabled: false });
    render(<BackupView />);
    const btn = screen.getByTestId("download-archive-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // ── Push to Backy ────────────────────────────────────────────────────

  it("calls handlePushToBacky on push button click", async () => {
    render(<BackupView />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("push-backy-btn"));
    });

    expect(mockBackupVM.handlePushToBacky).toHaveBeenCalled();
  });

  it("disables push button when encryption not enabled", () => {
    mockUseDashboardState.mockReturnValue({ encryptionEnabled: false });
    render(<BackupView />);
    const btn = screen.getByTestId("push-backy-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("shows push result", () => {
    mockBackupVM.lastPushResult = {
      ok: true,
      message: "Push successful (100ms)",
      durationMs: 100,
      request: { tag: "neo/1.0", fileName: "backup.zip", fileSizeBytes: 1024, secretCount: 5 },
    };
    render(<BackupView />);
    expect(screen.getByTestId("push-result")).toBeDefined();
    expect(screen.getByText("Push successful (100ms)")).toBeDefined();
  });

  it("shows backup history when available", () => {
    mockBackupVM.history = {
      project_name: "neo",
      environment: null,
      total_backups: 1,
      recent_backups: [
        { id: "b1", tag: "neo/1.0", environment: "production", file_size: 1024, is_single_json: 0, created_at: "2026-03-20T00:00:00Z" },
      ],
    };
    render(<BackupView />);
    expect(screen.getByText("Recent Backups")).toBeDefined();
    expect(screen.getByText("neo/1.0")).toBeDefined();
  });

  // ── Restore ──────────────────────────────────────────────────────────

  it("renders encryption key input for restore", () => {
    render(<BackupView />);
    expect(screen.getByTestId("restore-key-input")).toBeDefined();
  });

  it("disables upload button when no key entered", () => {
    render(<BackupView />);
    const btn = screen.getByTestId("restore-upload-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("enables upload button when key is entered", () => {
    render(<BackupView />);
    fireEvent.change(screen.getByTestId("restore-key-input"), { target: { value: "myKey" } });
    const btn = screen.getByTestId("restore-upload-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it("shows restore result", () => {
    mockBackupVM.lastRestoreResult = { imported: 3, skipped: 1, duplicates: 2 };
    render(<BackupView />);
    expect(screen.getByTestId("restore-result")).toBeDefined();
    expect(screen.getByText(/3 imported/)).toBeDefined();
    expect(screen.getByText(/1 skipped/)).toBeDefined();
    expect(screen.getByText(/2 duplicates/)).toBeDefined();
  });

  // ── Legacy Migration ─────────────────────────────────────────────────

  it("shows migration banner when legacy backups exist", () => {
    mockBackupVM.legacyBackupCount = 3;
    render(<BackupView />);
    expect(screen.getByTestId("legacy-migration-banner")).toBeDefined();
    expect(screen.getByText(/3 exportable legacy backups found/)).toBeDefined();
  });

  it("hides migration banner when no legacy backups", () => {
    mockBackupVM.legacyBackupCount = 0;
    render(<BackupView />);
    expect(screen.queryByTestId("legacy-migration-banner")).toBeNull();
  });

  it("shows export link in migration banner", () => {
    mockBackupVM.legacyBackupCount = 1;
    render(<BackupView />);
    const link = screen.getByTestId("legacy-export-link") as HTMLAnchorElement;
    expect(link.href).toContain("/api/backup/migrate");
  });

  it("disables export link when encryption not enabled", () => {
    mockBackupVM.legacyBackupCount = 2;
    mockUseDashboardState.mockReturnValue({ encryptionEnabled: false });
    render(<BackupView />);
    const link = screen.getByTestId("legacy-export-link");
    expect(link.className).toContain("pointer-events-none");
  });

  // ── Error / General ──────────────────────────────────────────────────

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
});
