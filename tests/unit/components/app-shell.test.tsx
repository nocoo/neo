/**
 * AppShell component tests.
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

import { AppShell } from "@/components/app-shell";

const defaultUser = {
  name: "Test User",
  email: "test@example.com",
  image: null,
};

// ── Tests ────────────────────────────────────────────────────────────────

describe("AppShell", () => {
  it("renders breadcrumb with page title", () => {
    render(<AppShell user={defaultUser}><div>content</div></AppShell>);
    const breadcrumbNav = screen.getByLabelText("Breadcrumb");
    expect(breadcrumbNav).toBeDefined();
    expect(breadcrumbNav.textContent).toContain("Secrets");
  });

  it("renders breadcrumbs with Home link for sub-pages", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    render(<AppShell user={defaultUser}><div>content</div></AppShell>);
    const breadcrumbNav = screen.getByLabelText("Breadcrumb");
    expect(breadcrumbNav.textContent).toContain("Home");
    expect(breadcrumbNav.textContent).toContain("Backup");
  });

  it("renders GitHub link with aria-label", () => {
    render(<AppShell user={defaultUser}><div>content</div></AppShell>);
    const githubLink = screen.getByLabelText("GitHub repository");
    expect(githubLink).toBeDefined();
    expect(githubLink.getAttribute("href")).toBe("https://github.com/nocoo/neo");
    expect(githubLink.getAttribute("target")).toBe("_blank");
  });

  it("renders ThemeToggle in header", () => {
    render(<AppShell user={defaultUser}><div>content</div></AppShell>);
    expect(screen.getByLabelText("Toggle theme")).toBeDefined();
  });

  it("renders children in content area", () => {
    render(<AppShell user={defaultUser}><div data-testid="child">hello</div></AppShell>);
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("renders sidebar with user info", () => {
    render(<AppShell user={defaultUser}><div>content</div></AppShell>);
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });
});
