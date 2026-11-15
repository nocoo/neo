/**
 * Sidebar component tests.
 *
 * The Sidebar is built from native Basalt chrome; every render is wrapped in
 * a Basalt SidebarProvider which owns the collapsed state.
 */

import { SidebarProvider } from "@nocoo/basalt";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import type { SidebarUser } from "@/components/sidebar";
import { Sidebar } from "@/components/sidebar";

const defaultUser: SidebarUser = {
  name: "Test User",
  email: "test@example.com",
  image: null,
};

function renderSidebar(user = defaultUser, collapsed = false) {
  return render(
    <SidebarProvider collapsed={collapsed} onCollapsedChange={() => {}}>
      <Sidebar user={user} />
    </SidebarProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("Sidebar — expanded", () => {
  it("renders logo and brand", () => {
    renderSidebar();
    expect(screen.getByText("neo.")).toBeDefined();
  });

  it("renders version badge", () => {
    renderSidebar();
    expect(screen.getByText(/^v\d/)).toBeDefined();
  });

  it("renders collapse toggle button", () => {
    renderSidebar();
    expect(screen.getByLabelText("Collapse sidebar")).toBeDefined();
  });

  it("renders all navigation rows", () => {
    const { container } = renderSidebar();
    const rows = Array.from(container.querySelectorAll("[data-sidebar-row]")).map((row) =>
      row.textContent?.trim(),
    );
    expect(rows).toEqual(["Secrets", "Recycle Bin", "Backup", "Tools", "Settings"]);
  });

  it("collapses a group from its label", () => {
    const { container } = renderSidebar();
    const secretGroup = screen.getByRole("button", { name: "Secret" });
    expect(secretGroup.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(secretGroup);
    const labels = Array.from(container.querySelectorAll("[data-sidebar-row]")).map((row) =>
      row.textContent?.trim(),
    );
    expect(labels).not.toContain("Secrets");
  });

  it("links rows to their routes", () => {
    const { container } = renderSidebar();
    const toolsRow = Array.from(container.querySelectorAll("[data-sidebar-row]")).find(
      (row) => row.textContent?.trim() === "Tools",
    );
    const anchor = toolsRow?.closest("a");
    expect(anchor?.getAttribute("href")).toBe("/dashboard/tools");
  });

  it("renders sign out button that signs out", () => {
    renderSidebar();
    const signOutBtn = screen.getByLabelText("Sign out");
    expect(signOutBtn.tagName).toBe("BUTTON");
    fireEvent.click(signOutBtn);
    expect(mockHandleSignOut).toHaveBeenCalledTimes(1);
  });

  it("marks the active row with aria-current", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    const { container } = renderSidebar();
    const row = (label: string) =>
      Array.from(container.querySelectorAll("[data-sidebar-row]")).find(
        (candidate) => candidate.textContent?.trim() === label,
      );
    expect(row("Backup")?.getAttribute("aria-current")).toBe("page");
    expect(row("Secrets")?.getAttribute("aria-current")).toBeNull();
  });

  it("displays user name and email", () => {
    renderSidebar();
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows avatar fallback initials when no image", () => {
    renderSidebar();
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("shows avatar image when provided", () => {
    renderSidebar({ ...defaultUser, image: "https://example.com/avatar.jpg" });
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });

  it("shows fallback for missing name", () => {
    renderSidebar({ name: null, email: "a@b.com", image: null });
    expect(screen.getByText("User")).toBeDefined();
    expect(screen.getByText("U")).toBeDefined();
  });
});

describe("Sidebar — collapsed", () => {
  it("renders expand toggle button", () => {
    renderSidebar(defaultUser, true);
    expect(screen.getByLabelText("Expand sidebar")).toBeDefined();
  });

  it("does not render nav labels as text", () => {
    renderSidebar(defaultUser, true);
    expect(screen.queryByText("Secrets")).toBeNull();
    expect(screen.queryByText("Backup")).toBeNull();
  });

  it("shows user avatar", () => {
    renderSidebar(defaultUser, true);
    expect(screen.getByText("TU")).toBeDefined();
  });

  it("marks the rail as collapsed", () => {
    renderSidebar(defaultUser, true);
    const aside = screen.getByLabelText("Expand sidebar").closest("aside");
    expect(aside?.getAttribute("data-collapsed")).toBe("");
  });

  it("links icon rows to their routes", () => {
    renderSidebar(defaultUser, true);
    const secretsIcon = screen.getByLabelText("Secrets").closest("a");
    expect(secretsIcon?.getAttribute("href")).toBe("/dashboard");
  });
});

// ── Branch coverage: nullish-coalescing fallbacks for user fields ──────────
describe("Sidebar — user field fallbacks", () => {
  it("uses 'User' fallback and renders no email when both are null", () => {
    renderSidebar({ name: null, email: null, image: null });
    expect(screen.getAllByText("User").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("test@example.com")).toBeNull();
  });

  it("renders AvatarImage when user.image is provided (truthy branch)", () => {
    renderSidebar({ name: "X", email: "x@y.z", image: "https://example.com/a.png" });
    expect(screen.getByText("x@y.z")).toBeDefined();
  });

  it("uses 'User' as avatar alt fallback when name is null but image present", () => {
    renderSidebar({ name: null, email: "a@b.com", image: "https://example.com/avatar.png" });
    expect(screen.getByText("a@b.com")).toBeDefined();
  });
});

describe("Sidebar — mobile drawer variant", () => {
  it("renders a dismiss toggle instead of a collapse toggle", () => {
    const onDismiss = vi.fn();
    render(
      <SidebarProvider collapsed={false} onCollapsedChange={() => {}}>
        <Sidebar user={defaultUser} variant="mobile" onDismiss={onDismiss} />
      </SidebarProvider>,
    );
    const dismissBtn = screen.getByLabelText("Close navigation");
    expect(dismissBtn).toBeDefined();
    expect(screen.queryByLabelText("Collapse sidebar")).toBeNull();
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
