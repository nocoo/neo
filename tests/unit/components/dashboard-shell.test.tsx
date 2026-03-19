/**
 * DashboardShell component tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockPathname, mockHandleSignOut, mockSetTheme } = vi.hoisted(() => ({
  mockPathname: vi.fn().mockReturnValue("/dashboard"),
  mockHandleSignOut: vi.fn(),
  mockSetTheme: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: mockPathname,
}));

vi.mock("@/actions/auth", () => ({
  handleSignOut: mockHandleSignOut,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: "system",
    setTheme: mockSetTheme,
    resolvedTheme: "light",
  }),
}));

// Mock matchMedia for useIsMobile hook (jsdom doesn't support it)
beforeEach(() => {
  vi.clearAllMocks();
  mockPathname.mockReturnValue("/dashboard");

  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(window, "innerWidth", { writable: true, value: 1024 });
});

import { DashboardShell } from "@/components/dashboard-shell";

const defaultUser = {
  name: "Test User",
  email: "test@example.com",
  image: null,
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("DashboardShell", () => {
  it("renders header with page title", () => {
    render(<DashboardShell user={defaultUser}><div>content</div></DashboardShell>);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Secrets");
  });

  it("renders correct title for backup page", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    render(<DashboardShell user={defaultUser}><div>content</div></DashboardShell>);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Backup");
  });

  it("renders GitHub link in header", () => {
    render(<DashboardShell user={defaultUser}><div>content</div></DashboardShell>);
    const githubLink = screen.getByTitle("GitHub");
    expect(githubLink).toBeDefined();
    expect(githubLink.getAttribute("href")).toBe("https://github.com/nocoo/neo");
    expect(githubLink.getAttribute("target")).toBe("_blank");
  });

  it("renders ThemeToggle in header", () => {
    render(<DashboardShell user={defaultUser}><div>content</div></DashboardShell>);
    expect(screen.getByLabelText("Toggle theme")).toBeDefined();
  });

  it("renders children in content area", () => {
    render(<DashboardShell user={defaultUser}><div data-testid="child">hello</div></DashboardShell>);
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("renders sidebar with user info", () => {
    render(<DashboardShell user={defaultUser}><div>content</div></DashboardShell>);
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });
});
