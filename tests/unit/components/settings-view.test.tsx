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
    encryptionKey: null as string | null,
    keyRevealed: false,
    backyWebhookUrl: null as string | null,
    backyMaskedApiKey: null as string | null,
    backyPullKey: null as string | null,
    loading: false,
    busy: false,
    error: null as string | null,
    handleUpdateTheme: vi.fn().mockResolvedValue(true),
    handleUpdateLanguage: vi.fn().mockResolvedValue(true),
    handleGenerateKey: vi.fn().mockResolvedValue(true),
    handleToggleKeyReveal: vi.fn(),
    handleCopyKey: vi.fn().mockResolvedValue(true),
    handleSaveBackyConfig: vi.fn().mockResolvedValue(true),
    handleTestBackyConnection: vi.fn().mockResolvedValue(true),
    handleGeneratePullWebhook: vi.fn().mockResolvedValue(true),
    handleRevokePullWebhook: vi.fn().mockResolvedValue(true),
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
  mockSettingsVM.encryptionKey = null;
  mockSettingsVM.keyRevealed = false;
  mockSettingsVM.backyWebhookUrl = null;
  mockSettingsVM.backyMaskedApiKey = null;
  mockSettingsVM.backyPullKey = null;
  mockSettingsVM.settings = {
    userId: "test-user",
    encryptionKeyHash: null,
    theme: "system",
    language: "en",
  };
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("SettingsView", () => {
  // ── Basic rendering ──────────────────────────────────────────────────

  it("renders theme selector", () => {
    render(<SettingsView />);
    expect(screen.getByLabelText("Theme")).toBeDefined();
  });

  it("renders language selector", () => {
    render(<SettingsView />);
    expect(screen.getByLabelText("Display Language")).toBeDefined();
  });

  // ── Theme ────────────────────────────────────────────────────────────

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

  it("uses DB theme for select value", () => {
    mockSettingsVM.settings = { ...mockSettingsVM.settings, theme: "dark" };
    render(<SettingsView />);
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect(select.value).toBe("dark");
  });

  it("syncs DB theme to next-themes on load when different", () => {
    mockSettingsVM.settings = { ...mockSettingsVM.settings, theme: "dark" };
    render(<SettingsView />);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("does not sync theme when DB matches next-themes", () => {
    mockSettingsVM.settings = { ...mockSettingsVM.settings, theme: "system" };
    render(<SettingsView />);
    expect(mockSetTheme).not.toHaveBeenCalled();
  });

  // ── Language ─────────────────────────────────────────────────────────

  it("calls handleUpdateLanguage on change", async () => {
    render(<SettingsView />);

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Display Language"), {
        target: { value: "zh" },
      });
    });

    expect(mockSettingsVM.handleUpdateLanguage).toHaveBeenCalledWith("zh");
  });

  it("shows coming soon note for language", () => {
    render(<SettingsView />);
    expect(screen.getByText(/coming soon/i)).toBeDefined();
  });

  // ── Encryption key management ────────────────────────────────────────

  it("shows generate key button when no key", () => {
    render(<SettingsView />);
    expect(screen.getByTestId("generate-key-btn")).toBeDefined();
    expect(screen.getByTestId("encryption-status").textContent).toBe("Disabled");
  });

  it("shows key management UI when key exists", () => {
    mockSettingsVM.encryptionEnabled = true;
    mockSettingsVM.encryptionKey = "testEncKey123";
    render(<SettingsView />);

    expect(screen.getByTestId("encryption-status").textContent).toBe("Enabled");
    expect(screen.getByTestId("encryption-key-display")).toBeDefined();
    // Key should be hidden by default
    expect(screen.getByTestId("encryption-key-display").textContent).toContain("••••");
  });

  it("reveals key when keyRevealed is true", () => {
    mockSettingsVM.encryptionEnabled = true;
    mockSettingsVM.encryptionKey = "testEncKey123";
    mockSettingsVM.keyRevealed = true;
    render(<SettingsView />);

    expect(screen.getByTestId("encryption-key-display").textContent).toBe("testEncKey123");
  });

  it("calls handleToggleKeyReveal on reveal button click", () => {
    mockSettingsVM.encryptionEnabled = true;
    mockSettingsVM.encryptionKey = "testEncKey123";
    render(<SettingsView />);

    fireEvent.click(screen.getByLabelText("Reveal key"));
    expect(mockSettingsVM.handleToggleKeyReveal).toHaveBeenCalled();
  });

  it("calls handleCopyKey on copy button click", async () => {
    mockSettingsVM.encryptionEnabled = true;
    mockSettingsVM.encryptionKey = "testEncKey123";
    render(<SettingsView />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Copy key"));
    });
    expect(mockSettingsVM.handleCopyKey).toHaveBeenCalled();
  });

  it("calls handleGenerateKey on generate button click", async () => {
    render(<SettingsView />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("generate-key-btn"));
    });
    expect(mockSettingsVM.handleGenerateKey).toHaveBeenCalled();
  });

  it("shows regenerate button when key exists", () => {
    mockSettingsVM.encryptionEnabled = true;
    mockSettingsVM.encryptionKey = "testEncKey123";
    render(<SettingsView />);

    expect(screen.getByTestId("regenerate-key-btn")).toBeDefined();
  });

  it("shows save key warning", () => {
    mockSettingsVM.encryptionEnabled = true;
    mockSettingsVM.encryptionKey = "testEncKey123";
    render(<SettingsView />);

    expect(screen.getByText(/Save this key externally/)).toBeDefined();
  });

  // ── Backy config ─────────────────────────────────────────────────────

  it("renders backy config section", () => {
    render(<SettingsView />);
    expect(screen.getByText("Backy Integration")).toBeDefined();
    expect(screen.getByLabelText("Webhook URL")).toBeDefined();
  });

  it("populates webhook URL from VM", () => {
    mockSettingsVM.backyWebhookUrl = "https://backy.test/wh";
    render(<SettingsView />);
    const input = screen.getByLabelText("Webhook URL") as HTMLInputElement;
    expect(input.value).toBe("https://backy.test/wh");
  });

  it("shows masked API key when configured", () => {
    mockSettingsVM.backyMaskedApiKey = "abc•••xyz";
    render(<SettingsView />);
    expect(screen.getByText("abc•••xyz")).toBeDefined();
  });

  it("calls handleSaveBackyConfig on save", async () => {
    render(<SettingsView />);

    // Enter URL
    fireEvent.change(screen.getByLabelText("Webhook URL"), {
      target: { value: "https://backy.test/wh" },
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-backy-btn"));
    });

    expect(mockSettingsVM.handleSaveBackyConfig).toHaveBeenCalled();
  });

  it("calls handleTestBackyConnection on test button", async () => {
    mockSettingsVM.backyWebhookUrl = "https://backy.test/wh";
    render(<SettingsView />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("test-connection-btn"));
    });

    expect(mockSettingsVM.handleTestBackyConnection).toHaveBeenCalled();
  });

  it("disables test button when no webhook configured", () => {
    render(<SettingsView />);
    const btn = screen.getByTestId("test-connection-btn") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  // ── Pull webhook key ─────────────────────────────────────────────────

  it("shows generate pull key button when no key", () => {
    render(<SettingsView />);
    expect(screen.getByTestId("generate-pull-key-btn")).toBeDefined();
  });

  it("shows pull key when configured", () => {
    mockSettingsVM.backyPullKey = "pullkey123abc";
    render(<SettingsView />);
    expect(screen.getByTestId("pull-key-display").textContent).toBe("pullkey123abc");
  });

  it("calls handleRevokePullWebhook on revoke button", async () => {
    mockSettingsVM.backyPullKey = "pullkey123abc";
    render(<SettingsView />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("revoke-pull-key-btn"));
    });

    expect(mockSettingsVM.handleRevokePullWebhook).toHaveBeenCalled();
  });

  // ── Error / General ──────────────────────────────────────────────────

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

  it("reloads settings on button click", async () => {
    render(<SettingsView />);

    await act(async () => {
      fireEvent.click(screen.getByText("Reload Settings"));
    });

    expect(mockSettingsVM.reload).toHaveBeenCalled();
  });
});
