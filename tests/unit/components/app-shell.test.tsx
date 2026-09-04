/**
 * AppShell component tests.
 */

import { ThemeProvider } from "@nocoo/basalt/providers/theme";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function renderAppShell(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("AppShell", () => {
  it("renders page title in header", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    const title = screen.getByRole("heading", { level: 1 });
    expect(title).toBeDefined();
    expect(title.textContent).toBe("Secrets");
  });

  it("renders breadcrumbs with Home link and page title for sub-pages", () => {
    mockPathname.mockReturnValue("/dashboard/backup");
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    const breadcrumbNav = screen.getByLabelText("Breadcrumb");
    expect(breadcrumbNav.textContent).toContain("Home");
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.textContent).toBe("Backup");
  });

  it("renders GitHub link with aria-label", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    const githubLink = screen.getByLabelText("GitHub repository");
    expect(githubLink).toBeDefined();
    expect(githubLink.getAttribute("href")).toBe("https://github.com/nocoo/neo");
    expect(githubLink.getAttribute("target")).toBe("_blank");
  });

  it("renders ThemeToggle in header", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    expect(screen.getByLabelText("Toggle theme")).toBeDefined();
  });

  it("renders children in content area", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div data-testid="child">hello</div>
      </AppShell>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("hello")).toBeDefined();
  });

  it("renders sidebar with user info", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    expect(screen.getByText("Test User")).toBeDefined();
    expect(screen.getByText("test@example.com")).toBeDefined();
  });
  it("falls back to default title for unknown pathname", () => {
    mockPathname.mockReturnValue("/dashboard/unknown");
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    const title = screen.getByRole("heading", { level: 1 });
    expect(title.textContent).toBe("Secrets");
  });
});

describe("AppShell — mobile mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/dashboard");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    Object.defineProperty(window, "innerWidth", { writable: true, value: 500 });
  });

  it("renders the mobile menu button and toggles the drawer", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    const menuBtn = screen.getByLabelText("Open menu");
    expect(menuBtn).toBeDefined();

    // Initially the mobile sidebar is closed — toggling opens it.
    fireEvent.click(menuBtn);
    // After opening, the user name should still be present (rendered inside the
    // mobile sidebar drawer).
    expect(screen.getAllByText("Test User").length).toBeGreaterThanOrEqual(1);
  });

  it("closes the mobile drawer when the overlay button is clicked", () => {
    renderAppShell(
      <AppShell user={defaultUser}>
        <div>content</div>
      </AppShell>,
    );
    // Open drawer first
    fireEvent.click(screen.getByLabelText("Open menu"));
    const overlay = screen.getByLabelText("Close sidebar overlay");
    expect(overlay).toBeDefined();

    // Clicking the overlay closes the drawer — overlay unmounts.
    fireEvent.click(overlay);
    expect(screen.queryByLabelText("Close sidebar overlay")).toBeNull();
  });
});
