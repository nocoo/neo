import { cache } from "react";
import { auth } from "@/auth";
import { ScopedDB } from "@/lib/db/scoped";

// ── E2E auth bypass ─────────────────────────────────────────────────────────
// When E2E_SKIP_AUTH=true AND not in production, all auth functions return
// a hardcoded test user. Same pattern as pew, backy, otter, raven.
// Production guard prevents accidental auth bypass if env var leaks.

const E2E_TEST_USER_ID = "e2e-test-user";

function isE2EMode(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.E2E_SKIP_AUTH === "true"
  );
}

/**
 * Deduplicated auth() — cached within a single React server render.
 */
export const getSession = cache(async () => {
  if (isE2EMode()) {
    return {
      user: { id: E2E_TEST_USER_ID, name: "E2E User", email: "e2e@test.local" },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    };
  }
  return auth();
});

/**
 * Get a ScopedDB instance for the current authenticated user.
 * Returns null if not authenticated.
 */
export async function getScopedDB(): Promise<ScopedDB | null> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  return new ScopedDB(userId);
}

/**
 * Get a ScopedDB instance and userId for the current authenticated user.
 * Returns null if not authenticated.
 */
export async function getAuthContext(): Promise<{
  db: ScopedDB;
  userId: string;
} | null> {
  const session = await getSession();
  const userId = session?.user?.id;
  if (!userId) return null;
  return { db: new ScopedDB(userId), userId };
}

/**
 * Verify the current user is authenticated and return the userId.
 * Returns null if not authenticated.
 */
export async function requireAuth(): Promise<string | null> {
  const session = await getSession();
  return session?.user?.id ?? null;
}
