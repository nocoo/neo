"use client";

/**
 * Auth ViewModel — provides user session state and auth actions.
 *
 * Wraps next-auth/react useSession for type-safe access.
 */

import { useCallback, useMemo } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

// ── Types ────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

export interface AuthViewModelState {
  /** Current authenticated user, or null if not signed in. */
  user: AuthUser | null;
  /** Whether the session is currently loading. */
  loading: boolean;
  /** Whether the user is authenticated. */
  authenticated: boolean;
}

export interface AuthViewModelActions {
  /** Sign in via Google OAuth. */
  handleSignIn: () => Promise<void>;
  /** Sign out and redirect to home. */
  handleSignOut: () => Promise<void>;
}

export type AuthViewModel = AuthViewModelState & AuthViewModelActions;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useAuthViewModel(): AuthViewModel {
  const { data: session, status } = useSession();

  const user = useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;
    return {
      id: session.user.id ?? "",
      name: session.user.name ?? null,
      email: session.user.email ?? null,
      image: session.user.image ?? null,
    };
  }, [session]);

  const loading = status === "loading";
  const authenticated = status === "authenticated";

  const handleSignIn = useCallback(async () => {
    await signIn("google", { callbackUrl: "/dashboard" });
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
  }, []);

  return {
    user,
    loading,
    authenticated,
    handleSignIn,
    handleSignOut,
  };
}
