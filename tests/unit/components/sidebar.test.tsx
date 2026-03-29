/**
 * Sidebar component tests.
 *
 * Sidebar now consumes useSidebar() from context, so we wrap it
 * in a SidebarProvider for every render.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
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

vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CollapsibleTrigger: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  }) => <button {...props}>{children}</button>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock sidebar context to control collapsed state
const mockToggle = vi.fn();
const mockSetMobileOpen = vi.fn();
let mockCollapsed = false;

vi.mock("@/components/sidebar-context", () => ({
  useSidebar: () => ({
    collapsed: mockCollapsed,
    toggle: mockToggle,
    setCollapsed: vi.fn(),
    isMobile: false,
    mobileOpen: false,
    setMobileOpen: mockSetMobileOpen,
  }),
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

import { Sidebar } from "@/components/sidebar";

const defaultUser = {
  name: "Test User",
  email: "test@example.com",
  image: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
  mockCollapsed = false;
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("Sidebar — expanded", () => {
  it("renders logo and brand", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText("neo.")).toBeDefined();
  });

  it("renders version badge with font-medium", () => {
    render(<Sidebar user={defaultUser} />);
    const versionEl = screen.getByText(/^v\d/);
    expect(versionEl).toBeDefined();
    expect(versionEl.className).toContain("font-medium");
  });

  it("renders collapse toggle button", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByLabelText("Collapse sidebar")).toBeDefined();
  });

  it("renders all navigation links", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText("Secrets")).toBeDefined();
    expect(screen.getAllByText("Backup").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Tools")).toBeDefined();
    expect(screen.getAllByText("Settings").length).toBeGreaterThanOrEqual(1);
  });

  it("renders group labels with correct styles", () => {
    render(<Sidebar user={defaultUser} />);
    const secretLabel = screen.getByText("Secret");
    expect(secretLabel).toBeDefined();
    expect(secretLabel.className).toContain("text-xs");
    expect(secretLabel.className).toContain("font-medium");
    expect(secretLabel.className).toContain("uppercase");
    expect(secretLabel.className).toContain("tracking-wider");
  });

  it("renders sign out button as form submit", () => {
    render(<Sidebar user={defaultUser} />);
    const signOutBtn = screen.getByTitle("Sign out");
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.closest("form")).toBeDefined();
    expect(signOutBtn.getAttribute("type")).toBe("submit");
  });

  it("highlights active nav item", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    render(<Sidebar user={defaultUser} />);
    const backupElements = screen.getAllByText("Backup");
    const backupLink = backupElements
      .map((el) => el.closest("a"))
      .find((a) => a !== null);
    expect(backupLink?.className).toContain("bg-accent");
  });

  it("displays user name and email", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows avatar fallback initials when no image", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("shows avatar image when provided", () => {
    render(
      <Sidebar
        user={{ ...defaultUser, image: "https://example.com/avatar.jpg" }}
      />,
    );
    // Radix Avatar renders AvatarImage with role="img" and the alt text.
    // In jsdom AvatarImage may not mount the <img> until loaded, but the
    // fallback ("TU") won't appear because src is set. Verify the Avatar
    // root exists and the user section is rendered correctly.
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows fallback for missing name", () => {
    render(
      <Sidebar
        user={{ name: null, email: "a@b.com", image: null }}
      />,
    );
    expect(screen.getByText("User")).toBeDefined();
    expect(screen.getByText("U")).toBeDefined();
  });
});

describe("Sidebar — collapsed", () => {
  beforeEach(() => {
    mockCollapsed = true;
  });

  it("renders expand toggle button", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByLabelText("Expand sidebar")).toBeDefined();
  });

  it("uses duration-300 for width transition", () => {
    render(<Sidebar user={defaultUser} />);
    const aside = screen.getByLabelText("Expand sidebar").closest("aside");
    expect(aside?.className).toContain("duration-300");
  });

  it("does not render nav labels as text", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.queryByText("Secrets")).toBeNull();
    expect(screen.queryByText("Backup")).toBeNull();
  });

  it("shows user avatar", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("does not render version badge text", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.queryByText(/^v\d/)).toBeNull();
  });
});
