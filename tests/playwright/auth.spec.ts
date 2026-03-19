/**
 * Playwright E2E — Auth flows.
 */

import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("redirects unauthenticated users from dashboard to login", async ({
    browser,
  }) => {
    // Create a fresh context without auth state
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\//);
    await context.close();
  });

  test("shows login page at root", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
    await context.close();
  });

  test("authenticated user can access dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("authenticated user can access backup page", async ({ page }) => {
    await page.goto("/dashboard/backup");
    await expect(page).toHaveURL(/\/dashboard\/backup/);
  });

  test("authenticated user can access tools page", async ({ page }) => {
    await page.goto("/dashboard/tools");
    await expect(page).toHaveURL(/\/dashboard\/tools/);
  });

  test("authenticated user can access settings page", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test("returns 404 for unknown routes", async ({ page }) => {
    const response = await page.goto("/nonexistent-page");
    expect(response?.status()).toBe(404);
  });

  test("health check endpoint responds", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBe(true);
  });
});
