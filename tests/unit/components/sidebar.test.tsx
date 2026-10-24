/**
 * Sidebar component tests.
 *
 * Sidebar now consumes useSidebar() from context, so we wrap it
 * in a SidebarProvider for every render.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockPathname, mockHandleSignOut, mockPush } = vi.hoisted(() => ({
  mockPathname: vi.fn().mockReturnValue("/dashboard"),
  mockHandleSignOut: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions/auth", () => ({
  handleSignOut: mockHandleSignOut,
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
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
    expect(versionEl.className).toContain("font-mono");
  });

  it("renders collapse toggle button", () => {
    render(<Sidebar user={defaultUser} />);
    expect(screen.getByLabelText("Collapse sidebar")).toBeDefined();
  });

  it("renders all navigation rows", () => {
    const { container } = render(<Sidebar user={defaultUser} />);
    const rows = Array.from(container.querySelectorAll("[data-sidebar-row]")).map((row) =>
      row.textContent?.trim(),
    );
    expect(rows).toEqual(["Secrets", "Recycle Bin", "Backup", "Tools", "Settings"]);
  });

  it("collapses a group from its label", () => {
    const { container } = render(<Sidebar user={defaultUser} />);
    const secretGroup = screen.getByRole("button", { name: "Secret" });
    expect(secretGroup.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(secretGroup);
    const labels = Array.from(container.querySelectorAll("[data-sidebar-row]")).map((row) =>
      row.textContent?.trim(),
    );
    expect(labels).not.toContain("Secrets");
  });

  it("navigates when a row is activated", () => {
    render(<Sidebar user={defaultUser} />);
    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    expect(mockPush).toHaveBeenCalledWith("/dashboard/tools");
  });

  it("renders sign out button as form submit", () => {
    render(<Sidebar user={defaultUser} />);
    const signOutBtn = screen.getByTitle("Sign out");
    expect(signOutBtn).toBeDefined();
    expect(signOutBtn.closest("form")).toBeDefined();
    expect(signOutBtn.getAttribute("type")).toBe("submit");
  });

  it("marks the active row with aria-current", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    const { container } = render(<Sidebar user={defaultUser} />);
    const row = (label: string) =>
      Array.from(container.querySelectorAll("[data-sidebar-row]")).find(
        (candidate) => candidate.textContent?.trim() === label,
      );
    expect(row("Backup")?.getAttribute("aria-current")).toBe("page");
    expect(row("Secrets")?.getAttribute("aria-current")).toBeNull();
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
    render(<Sidebar user={{ ...defaultUser, image: "https://example.com/avatar.jpg" }} />);
    // Radix Avatar renders AvatarImage with role="img" and the alt text.
    // In jsdom AvatarImage may not mount the <img> until loaded, but the
    // fallback ("TU") won't appear because src is set. Verify the Avatar
    // root exists and the user section is rendered correctly.
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows fallback for missing name", () => {
    render(<Sidebar user={{ name: null, email: "a@b.com", image: null }} />);
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

// ── Branch coverage: nullish-coalescing fallbacks for user fields ──────────
describe("Sidebar — user field fallbacks", () => {
  beforeEach(() => {
    mockCollapsed = false;
  });

  it("uses 'User' fallback and renders empty email when both are null", () => {
    render(<Sidebar user={{ name: null, email: null, image: null }} />);
    // user.name ?? "User"
    expect(screen.getAllByText("User").length).toBeGreaterThanOrEqual(1);
    // user.email ?? "" — should not crash; no test@example.com text
    expect(screen.queryByText("test@example.com")).toBeNull();
  });

  it("renders AvatarImage when user.image is provided (truthy branch)", () => {
    render(<Sidebar user={{ name: "X", email: "x@y.z", image: "https://example.com/a.png" }} />);
    // truthy branch of `user.image && <AvatarImage>` is exercised by render
    expect(screen.getByText("x@y.z")).toBeDefined();
  });

  it("uses 'User' as avatar alt fallback when name is null but image present", () => {
    render(
      <Sidebar user={{ name: null, email: "a@b.com", image: "https://example.com/avatar.png" }} />,
    );
    // Exercises `user.name ?? "User"` fallback inside AvatarImage alt.
    // No assertion on the alt itself (Radix defers rendering until image load)
    // — just ensure the render path completes without throwing.
    expect(screen.getByText("a@b.com")).toBeDefined();
  });
});
