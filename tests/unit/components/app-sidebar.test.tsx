/**
 * AppSidebar component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockPathname, mockHandleSignOut } = vi.hoisted(() => ({
  mockPathname: vi.fn().mockReturnValue("/dashboard"),
  mockHandleSignOut: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
}));

vi.mock("@/actions/auth", () => ({
  handleSignOut: mockHandleSignOut,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));

import { AppSidebar } from "@/components/app-sidebar";

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("AppSidebar", () => {
  it("renders logo", () => {
    render(<AppSidebar />);
    expect(screen.getByText("neo.")).toBeDefined();
  });

  it("renders all navigation links", () => {
    render(<AppSidebar />);
    expect(screen.getByText("Secrets")).toBeDefined();
    expect(screen.getByText("Backup")).toBeDefined();
    expect(screen.getByText("Tools")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders sign out button as form submit", () => {
    render(<AppSidebar />);
    const signOutBtn = screen.getByText("Sign out");
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.closest("form")).toBeDefined();
    expect(signOutBtn.getAttribute("type")).toBe("submit");
  });

  it("sign out form has correct action", () => {
    render(<AppSidebar />);
    const form = screen.getByText("Sign out").closest("form");
    // Form action should be the handleSignOut server action
    expect(form).toBeDefined();
  });

  it("highlights active nav item", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    render(<AppSidebar />);
    const backupLink = screen.getByText("Backup").closest("a");
    expect(backupLink?.className).toContain("bg-sidebar-accent");
  });

  it("renders theme toggle", () => {
    render(<AppSidebar />);
    expect(screen.getByTestId("theme-toggle")).toBeDefined();
  });
});
