/**
 * Auth ViewModel tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const { mockUseSession, mockSignIn, mockSignOut } = vi.hoisted(() => {
  return {
    mockUseSession: vi.fn(),
    mockSignIn: vi.fn(),
    mockSignOut: vi.fn(),
  };
});

vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
  signIn: mockSignIn,
  signOut: mockSignOut,
}));

import { useAuthViewModel } from "@/viewmodels/useAuthViewModel";

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockSignIn.mockResolvedValue(undefined);
  mockSignOut.mockResolvedValue(undefined);
});

describe("useAuthViewModel", () => {
  it("returns loading state when session is loading", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });

    const { result } = renderHook(() => useAuthViewModel());

    expect(result.current.loading).toBe(true);
    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("returns user when authenticated", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: {
          id: "user-123",
          name: "John Doe",
          email: "john@example.com",
          image: "https://example.com/avatar.jpg",
        },
      },
      status: "authenticated",
    });

    const { result } = renderHook(() => useAuthViewModel());

    expect(result.current.loading).toBe(false);
    expect(result.current.authenticated).toBe(true);
    expect(result.current.user).toEqual({
      id: "user-123",
      name: "John Doe",
      email: "john@example.com",
      image: "https://example.com/avatar.jpg",
    });
  });

  it("returns null user when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useAuthViewModel());

    expect(result.current.authenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("calls signIn with google provider", async () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useAuthViewModel());

    await act(async () => {
      await result.current.handleSignIn();
    });

    expect(mockSignIn).toHaveBeenCalledWith("google", { callbackUrl: "/dashboard" });
  });

  it("calls signOut with redirect to home", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-123" } },
      status: "authenticated",
    });

    const { result } = renderHook(() => useAuthViewModel());

    await act(async () => {
      await result.current.handleSignOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/" });
  });

  it("handles missing user id gracefully", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { name: "NoId", email: "noid@test.com", image: null },
      },
      status: "authenticated",
    });

    const { result } = renderHook(() => useAuthViewModel());

    expect(result.current.user?.id).toBe("");
  });
});
