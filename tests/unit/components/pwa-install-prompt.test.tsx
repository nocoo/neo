/**
 * PWA install prompt tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: string;
    size?: string;
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  Download: () => <svg data-testid="download-icon" />,
  X: () => <svg data-testid="x-icon" />,
}));

import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

// ── Helpers ──────────────────────────────────────────────────────────────

function createMockPromptEvent() {
  const promptFn = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({
    outcome: "accepted" as const,
  });

  return {
    event: Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: promptFn,
      userChoice,
    }),
    promptFn,
  };
}

function fireBeforeInstallPrompt() {
  const mock = createMockPromptEvent();
  act(() => {
    window.dispatchEvent(mock.event);
  });
  return mock;
}

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("PwaInstallPrompt", () => {
  it("does not render when no beforeinstallprompt fired", () => {
    render(<PwaInstallPrompt />);
    expect(screen.queryByTestId("pwa-install-prompt")).toBeNull();
  });

  it("renders banner after beforeinstallprompt event", () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.getByTestId("pwa-install-prompt")).toBeDefined();
  });

  it("shows install text", () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.getByText("Install Neo")).toBeDefined();
  });

  it("shows description text", () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();
    expect(screen.getByText(/home screen/)).toBeDefined();
  });

  it("calls prompt() when install is clicked", async () => {
    render(<PwaInstallPrompt />);
    const { promptFn } = fireBeforeInstallPrompt();

    await act(async () => {
      fireEvent.click(screen.getByText("Install"));
    });

    expect(promptFn).toHaveBeenCalled();
  });

  it("hides banner after accepted install", async () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();

    await act(async () => {
      fireEvent.click(screen.getByText("Install"));
    });

    expect(screen.queryByTestId("pwa-install-prompt")).toBeNull();
  });

  it("dismisses banner on X button click", () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();

    fireEvent.click(screen.getByLabelText("Dismiss install prompt"));
    expect(screen.queryByTestId("pwa-install-prompt")).toBeNull();
  });

  it("dismisses banner on Not Now click", () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();

    fireEvent.click(screen.getByText("Not Now"));
    expect(screen.queryByTestId("pwa-install-prompt")).toBeNull();
  });

  it("stays dismissed after new beforeinstallprompt events", () => {
    render(<PwaInstallPrompt />);
    fireBeforeInstallPrompt();

    fireEvent.click(screen.getByText("Not Now"));

    // Fire a new event
    fireBeforeInstallPrompt();

    // Should stay hidden because dismissed is true
    expect(screen.queryByTestId("pwa-install-prompt")).toBeNull();
  });

  it("cleans up event listener on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<PwaInstallPrompt />);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith(
      "beforeinstallprompt",
      expect.any(Function)
    );
  });
});
