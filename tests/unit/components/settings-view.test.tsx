/**
 * SettingsView component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockSettingsVM, mockSetTheme } = vi.hoisted(() => {
  const mockSettingsVM = {
    settings: {
      userId: "test-user",
      encryptionKeyHash: null,
      theme: "system",
      language: "en",
    },
    encryptionEnabled: false,
    loading: false,
    busy: false,
    error: null,
    handleUpdateTheme: vi.fn().mockResolvedValue(true),
    handleUpdateLanguage: vi.fn().mockResolvedValue(true),
    handleUpdateEncryption: vi.fn().mockResolvedValue(true),
    reload: vi.fn().mockResolvedValue(undefined),
    clearError: vi.fn(),
  };

  const mockSetTheme = vi.fn();

  return { mockSettingsVM, mockSetTheme };
});

vi.mock("@/viewmodels/useSettingsViewModel", () => ({
  useSettingsViewModel: () => mockSettingsVM,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: mockSetTheme,
  }),
}));

import { SettingsView } from "@/components/settings-view";

beforeEach(() => {
  vi.clearAllMocks();
  mockSettingsVM.loading = false;
  mockSettingsVM.busy = false;
  mockSettingsVM.error = null;
  mockSettingsVM.encryptionEnabled = false;
  mockSettingsVM.settings = {
    userId: "test-user",
    encryptionKeyHash: null,
    theme: "system",
    language: "en",
  };
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("SettingsView", () => {
  it("renders page header", () => {
    render(<SettingsView />);
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("shows loading state", () => {
    mockSettingsVM.loading = true;
    render(<SettingsView />);
    expect(screen.getByText("Loading settings...")).toBeDefined();
  });

  it("renders theme selector", () => {
    render(<SettingsView />);
    expect(screen.getByLabelText("Theme")).toBeDefined();
  });

  it("renders language selector", () => {
    render(<SettingsView />);
    expect(screen.getByLabelText("Display Language")).toBeDefined();
  });

  it("calls setTheme and handleUpdateTheme on change", async () => {
    render(<SettingsView />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Theme"), {
        target: { value: "dark" },
      });
    });

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
    expect(mockSettingsVM.handleUpdateTheme).toHaveBeenCalledWith("dark");
  });

  it("calls handleUpdateLanguage on change", async () => {
    render(<SettingsView />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Display Language"), {
        target: { value: "zh" },
      });
    });

    expect(mockSettingsVM.handleUpdateLanguage).toHaveBeenCalledWith("zh");
  });

  it("shows encryption enabled with accurate description", () => {
    mockSettingsVM.encryptionEnabled = true;
    render(<SettingsView />);
    expect(screen.getByTestId("encryption-status").textContent).toBe("Enabled");
    expect(screen.getByText(/Scheduled backups are encrypted/)).toBeDefined();
    expect(screen.getByText(/Manual backups are stored as plaintext/)).toBeDefined();
  });

  it("shows encryption disabled with accurate description", () => {
    render(<SettingsView />);
    expect(screen.getByTestId("encryption-status").textContent).toBe("Disabled");
    expect(screen.getByText(/No encryption key configured/)).toBeDefined();
  });

  it("shows error banner", () => {
    mockSettingsVM.error = "Something went wrong";
    render(<SettingsView />);
    expect(screen.getByText("Something went wrong")).toBeDefined();
  });

  it("dismisses error", () => {
    mockSettingsVM.error = "Error";
    render(<SettingsView />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(mockSettingsVM.clearError).toHaveBeenCalled();
  });

  it("shows coming soon note for language", () => {
    render(<SettingsView />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
  });

  it("reloads settings on button click", async () => {
    render(<SettingsView />);

    await act(async () => {
      fireEvent.click(screen.getByText("Reload Settings"));
    });

    expect(mockSettingsVM.reload).toHaveBeenCalled();
  });
});
