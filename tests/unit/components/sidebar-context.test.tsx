/**
 * SidebarProvider/useSidebar context tests.
 *
 * Cover the value-mapping branches that wrap the underlying view model:
 *   setCollapsed → toggleSidebar
 *   setMobileOpen(true) → toggleSidebar
 *   setMobileOpen(false) → closeMobileSidebar
 * Plus the error path of useSidebar() outside a provider.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { mockVm } = vi.hoisted(() => ({
  mockVm: {
    collapsed: false,
    isMobile: false,
    mobileOpen: false,
    toggleSidebar: vi.fn(),
    closeMobileSidebar: vi.fn(),
  },
}));

vi.mock("@/viewmodels/useDashboardLayoutViewModel", () => ({
  useDashboardLayoutViewModel: () => mockVm,
}));

import { SidebarProvider, useSidebar } from "@/components/sidebar-context";

beforeEach(() => {
  vi.clearAllMocks();
});

function Probe() {
  const ctx = useSidebar();
  return (
    <div>
      <span data-testid="collapsed">{String(ctx.collapsed)}</span>
      <span data-testid="mobile">{String(ctx.isMobile)}</span>
      <button onClick={ctx.toggle}>toggle</button>
      <button onClick={() => ctx.setCollapsed(true)}>setCollapsed</button>
      <button onClick={() => ctx.setMobileOpen(true)}>openMobile</button>
      <button onClick={() => ctx.setMobileOpen(false)}>closeMobile</button>
    </div>
  );
}

describe("SidebarProvider", () => {
  it("exposes view model values", () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );
    expect(screen.getByTestId("collapsed").textContent).toBe("false");
    expect(screen.getByTestId("mobile").textContent).toBe("false");
  });

  it("toggle calls vm.toggleSidebar", () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText("toggle"));
    expect(mockVm.toggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("setCollapsed delegates to toggleSidebar", () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText("setCollapsed"));
    expect(mockVm.toggleSidebar).toHaveBeenCalledTimes(1);
  });

  it("setMobileOpen(true) delegates to toggleSidebar", () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText("openMobile"));
    expect(mockVm.toggleSidebar).toHaveBeenCalledTimes(1);
    expect(mockVm.closeMobileSidebar).not.toHaveBeenCalled();
  });

  it("setMobileOpen(false) delegates to closeMobileSidebar", () => {
    render(
      <SidebarProvider>
        <Probe />
      </SidebarProvider>,
    );
    fireEvent.click(screen.getByText("closeMobile"));
    expect(mockVm.closeMobileSidebar).toHaveBeenCalledTimes(1);
    expect(mockVm.toggleSidebar).not.toHaveBeenCalled();
  });
});

describe("useSidebar", () => {
  it("throws when used outside a provider", () => {
    function Bare() {
      useSidebar();
      return null;
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow(/SidebarProvider/);
    spy.mockRestore();
  });
});
