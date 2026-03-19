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

import { AppSidebar } from "@/components/app-sidebar";

const defaultUser = {
  name: "Test User",
  email: "test@example.com",
  image: null,
};

const defaultProps = {
  collapsed: false,
  onToggle: vi.fn(),
  user: defaultUser,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("AppSidebar — expanded", () => {
  it("renders logo and brand", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("neo.")).toBeDefined();
  });

  it("renders version badge", () => {
    render(<AppSidebar {...defaultProps} />);
    const versionEl = screen.getByText(/^v\d/);
    expect(versionEl).toBeDefined();
  });

  it("renders collapse toggle button", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByLabelText("Collapse sidebar")).toBeDefined();
  });

  it("renders all navigation links", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("Secrets")).toBeDefined();
    expect(screen.getByText("Backup")).toBeDefined();
    expect(screen.getByText("Tools")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders sign out button as form submit", () => {
    render(<AppSidebar {...defaultProps} />);
    const signOutBtn = screen.getByTitle("Sign out");
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.closest("form")).toBeDefined();
    expect(signOutBtn.getAttribute("type")).toBe("submit");
  });

  it("highlights active nav item", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    render(<AppSidebar {...defaultProps} />);
    const backupLink = screen.getByText("Backup").closest("a");
    expect(backupLink?.className).toContain("bg-accent");
  });

  it("displays user name and email", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows initials when no avatar image", () => {
    render(<AppSidebar {...defaultProps} />);
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("shows avatar image when provided", () => {
    render(
      <AppSidebar
        {...defaultProps}
        user={{ ...defaultUser, image: "https://example.com/avatar.jpg" }}
      />
    );
    const img = screen.getByAltText("Test User");
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("https://example.com/avatar.jpg");
  });

  it("shows fallback for missing name", () => {
    render(
      <AppSidebar
        {...defaultProps}
        user={{ name: null, email: "a@b.com", image: null }}
      />
    );
    expect(screen.getByText("User")).toBeDefined();
    expect(screen.getByText("U")).toBeDefined();
  });
});

describe("AppSidebar — collapsed", () => {
  const collapsedProps = { ...defaultProps, collapsed: true };

  it("renders expand toggle button", () => {
    render(<AppSidebar {...collapsedProps} />);
    expect(screen.getByLabelText("Expand sidebar")).toBeDefined();
  });

  it("renders nav items as icon-only with title tooltips", () => {
    render(<AppSidebar {...collapsedProps} />);
    expect(screen.getByTitle("Secrets")).toBeDefined();
    expect(screen.getByTitle("Backup")).toBeDefined();
    expect(screen.getByTitle("Tools")).toBeDefined();
    expect(screen.getByTitle("Settings")).toBeDefined();
  });

  it("does not render nav labels as text", () => {
    render(<AppSidebar {...collapsedProps} />);
    expect(screen.queryByText("Secrets")).toBeNull();
    expect(screen.queryByText("Backup")).toBeNull();
  });

  it("shows user avatar", () => {
    render(<AppSidebar {...collapsedProps} />);
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("does not render version badge text", () => {
    render(<AppSidebar {...collapsedProps} />);
    expect(screen.queryByText(/^v\d/)).toBeNull();
  });
});
