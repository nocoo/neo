/**
 * Dashboard layout ViewModel tests — sidebar toggle and mobile drawer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

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

  it("starts with sidebar expanded and mobile closed", () => {
    const { result } = renderHook(() => useDashboardLayoutViewModel());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.mobileOpen).toBe(false);
  });

  it("toggles collapsed on desktop", () => {
    const { result } = renderHook(() => useDashboardLayoutViewModel());

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.collapsed).toBe(true);

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.collapsed).toBe(false);
  });

  it("toggles mobileOpen on mobile", () => {
    mockUseIsMobile.mockReturnValue(true);
    const { result } = renderHook(() => useDashboardLayoutViewModel());

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.mobileOpen).toBe(true);

    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.mobileOpen).toBe(false);
  });

  it("closeMobileSidebar sets mobileOpen to false", () => {
    mockUseIsMobile.mockReturnValue(true);
    const { result } = renderHook(() => useDashboardLayoutViewModel());

    act(() => {
      result.current.toggleSidebar();
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
