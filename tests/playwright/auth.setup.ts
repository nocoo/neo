/**
 * Playwright auth setup — logs in via Credentials provider (E2E mode).
 *
 * The custom sign-in page at "/" only has the Google OAuth button, so we
 * authenticate by POSTing directly to the NextAuth credentials callback
 * endpoint, which sets the session JWT cookie in the browser context.
 *
 * This runs once before all tests and stores the auth state
 * in tests/playwright/.auth/user.json for reuse.
 */

import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "tests/playwright/.auth/user.json";

setup("authenticate", async ({ page, baseURL }) => {
  const base = baseURL ?? "http://localhost:27042";

  // 1. Fetch CSRF token from NextAuth
  const csrfRes = await page.request.get(`${base}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  // 2. POST to the credentials callback to sign in.
  //    Use maxRedirects: 0 because NextAuth redirects to the callback-url
  //    (https://neo.dev.hexly.ai) which causes a TLS error in local dev.
  //    We only need the session cookie from the 302 response.
  await page.request.post(`${base}/api/auth/callback/e2e-credentials`, {
    form: {
      csrfToken,
      email: "e2e@test.local",
      name: "E2E Test User",
    },
    maxRedirects: 0,
  });

  // 3. Navigate to dashboard to verify the session is active
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE });
});
