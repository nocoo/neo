"use server";

/**
 * Auth Server Actions.
 *
 * Wraps NextAuth server-side functions for use in client components.
 */

import { signOut } from "@/auth";

/**
 * Sign out the current user and redirect to home.
 */
export async function handleSignOut(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
