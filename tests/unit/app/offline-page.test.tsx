/**
 * Offline page tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
  }) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("lucide-react", () => ({
  WifiOff: () => <svg data-testid="wifi-off-icon" />,
  RefreshCw: () => <svg data-testid="refresh-icon" />,
}));

import OfflinePage from "@/app/offline/page";

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("OfflinePage", () => {
  it("renders the offline heading", () => {
    render(<OfflinePage />);
    expect(screen.getByText("You're Offline")).toBeDefined();
  });

  it("renders the wifi-off icon", () => {
    render(<OfflinePage />);
    expect(screen.getByTestId("wifi-off-icon")).toBeDefined();
  });

  it("renders description text", () => {
    render(<OfflinePage />);
    expect(
      screen.getByText(/lost your internet connection/)
    ).toBeDefined();
  });

  it("renders try again button", () => {
    render(<OfflinePage />);
    expect(screen.getByText("Try Again")).toBeDefined();
  });

  it("renders go back button", () => {
    render(<OfflinePage />);
    expect(screen.getByText("Go Back")).toBeDefined();
  });

  it("reloads page on try again click", () => {
    const reloadMock = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: reloadMock },
      writable: true,
    });

    render(<OfflinePage />);
    fireEvent.click(screen.getByText("Try Again"));
    expect(reloadMock).toHaveBeenCalled();
  });

  it("goes back on go back click", () => {
    const backMock = vi.fn();
    Object.defineProperty(window, "history", {
      value: { back: backMock },
      writable: true,
    });

    render(<OfflinePage />);
    fireEvent.click(screen.getByText("Go Back"));
    expect(backMock).toHaveBeenCalled();
  });

  it("shows offline sync message", () => {
    render(<OfflinePage />);
    expect(
      screen.getByText(/synced automatically/)
    ).toBeDefined();
  });
});
