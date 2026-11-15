/**
 * Dashboard layout ViewModel tests — mobile drawer state.
 * Desktop rail collapse is owned by the Basalt SidebarProvider.
 */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockUseIsMobile } = vi.hoisted(() => {
  return { mockUseIsMobile: vi.fn() };
});

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: mockUseIsMobile,
}));

import { useDashboardLayoutViewModel } from "@/viewmodels/useDashboardLayoutViewModel";

describe("useDashboardLayoutViewModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsMobile.mockReturnValue(false);
  });

  it("starts with the mobile drawer closed", () => {
    const { result } = renderHook(() => useDashboardLayoutViewModel());
    expect(result.current.mobileOpen).toBe(false);
  });

  it("opens and closes the drawer via setMobileOpen", () => {
    const { result } = renderHook(() => useDashboardLayoutViewModel());

    act(() => {
      result.current.setMobileOpen(true);
    });
    expect(result.current.mobileOpen).toBe(true);

    act(() => {
      result.current.setMobileOpen(false);
    });
    expect(result.current.mobileOpen).toBe(false);
  });

  it("closeMobileSidebar sets mobileOpen to false", () => {
    const { result } = renderHook(() => useDashboardLayoutViewModel());

    act(() => {
      result.current.setMobileOpen(true);
    });
    expect(result.current.mobileOpen).toBe(true);

    act(() => {
      result.current.closeMobileSidebar();
    });
    expect(result.current.mobileOpen).toBe(false);
  });

  it("exposes isMobile from hook", () => {
    mockUseIsMobile.mockReturnValue(true);
    const { result } = renderHook(() => useDashboardLayoutViewModel());
    expect(result.current.isMobile).toBe(true);
  });
});
