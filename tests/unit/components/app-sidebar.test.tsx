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

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("AppSidebar", () => {
  it("renders logo", () => {
    render(<AppSidebar user={defaultUser} />);
    expect(screen.getByText("neo.")).toBeDefined();
  });

  it("renders all navigation links", () => {
    render(<AppSidebar user={defaultUser} />);
    expect(screen.getByText("Secrets")).toBeDefined();
    expect(screen.getByText("Backup")).toBeDefined();
    expect(screen.getByText("Tools")).toBeDefined();
    expect(screen.getByText("Settings")).toBeDefined();
  });

  it("renders sign out button as form submit", () => {
    render(<AppSidebar user={defaultUser} />);
    const signOutBtn = screen.getByTitle("Sign out");
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.closest("form")).toBeDefined();
    expect(signOutBtn.getAttribute("type")).toBe("submit");
  });

  it("highlights active nav item", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    render(<AppSidebar user={defaultUser} />);
    const backupLink = screen.getByText("Backup").closest("a");
    expect(backupLink?.className).toContain("bg-sidebar-accent");
  });

  it("displays user name and email", () => {
    render(<AppSidebar user={defaultUser} />);
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows initials when no avatar image", () => {
    render(<AppSidebar user={defaultUser} />);
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("shows avatar image when provided", () => {
    render(
      <AppSidebar
        user={{ ...defaultUser, image: "https://example.com/avatar.jpg" }}
      />
    );
    const img = screen.getByAltText("Test User");
    expect(img).toBeDefined();
    expect(img.getAttribute("src")).toBe("https://example.com/avatar.jpg");
  });

  it("shows fallback for missing name", () => {
    render(<AppSidebar user={{ name: null, email: "a@b.com", image: null }} />);
    expect(screen.getByText("User")).toBeDefined();
    expect(screen.getByText("U")).toBeDefined();
  });
});
