/**
 * Playwright auth setup — logs in via Credentials provider (E2E mode).
 *
 * This runs once before all tests and stores the auth state
 * in tests/playwright/.auth/user.json for reuse.
 */

import { test as setup, expect } from "@playwright/test";

const AUTH_FILE = "tests/playwright/.auth/user.json";

setup("authenticate", async ({ page }) => {
  // Navigate to sign-in endpoint with Credentials provider
  await page.goto("/api/auth/signin");

  // The E2E credentials form should be present when PLAYWRIGHT=1
  // Fill in the email field for the e2e-credentials provider
  const emailInput = page.locator('input[name="email"]').first();

  if (await emailInput.isVisible({ timeout: 5000 })) {
    await emailInput.fill("e2e@test.local");
    await page.locator('button[type="submit"]').first().click();

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain("/dashboard");
  }

  // Save auth state
  await page.context().storageState({ path: AUTH_FILE });
});
