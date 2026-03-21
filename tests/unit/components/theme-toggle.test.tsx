/**
 * ThemeToggle component tests — covers the cycle() branches.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockSetTheme, mockUseTheme } = vi.hoisted(() => {
  const mockSetTheme = vi.fn();
  const mockUseTheme = vi.fn();
  return { mockSetTheme, mockUseTheme };
});

vi.mock("next-themes", () => ({
  useTheme: mockUseTheme,
}));

import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cycles from system to light", () => {
    mockUseTheme.mockReturnValue({ theme: "system", setTheme: mockSetTheme, resolvedTheme: "light" });
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("cycles from light to dark", () => {
    mockUseTheme.mockReturnValue({ theme: "light", setTheme: mockSetTheme, resolvedTheme: "light" });
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("cycles from dark to system", () => {
    mockUseTheme.mockReturnValue({ theme: "dark", setTheme: mockSetTheme, resolvedTheme: "dark" });
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(mockSetTheme).toHaveBeenCalledWith("system");
  });
});
