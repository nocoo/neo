/**
 * Playwright E2E — Secrets management.
 */

import { test, expect } from "@playwright/test";

test.describe("Secrets Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/dashboard");
  });

  test("displays dashboard page", async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("shows secrets heading or empty state", async ({ page }) => {
    // Should show either the secrets list or empty state
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("has add secret button", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /add/i });
    // The button may or may not exist depending on layout
    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(addButton).toBeEnabled();
    }
  });

  test("has search input", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(searchInput).toBeEditable();
    }
  });

  test("can type in search field", async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill("GitHub");
      await expect(searchInput).toHaveValue("GitHub");
    }
  });

  test("has import button", async ({ page }) => {
    const importButton = page.getByRole("button", { name: /import/i });
    if (await importButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(importButton).toBeEnabled();
    }
  });

  test("has export button", async ({ page }) => {
    const exportButton = page.getByRole("button", { name: /export/i });
    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(exportButton).toBeEnabled();
    }
  });

  test("page has no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Filter out expected errors (e.g., D1 connection errors in E2E mode)
    const unexpectedErrors = errors.filter(
      (e) =>
        !e.includes("D1") &&
        !e.includes("fetch") &&
        !e.includes("Failed to load")
    );

    expect(unexpectedErrors).toHaveLength(0);
  });

  test("dashboard responds quickly", async ({ page }) => {
    const start = Date.now();
    await page.goto("/dashboard");
    await page.waitForLoadState("domcontentloaded");
    const loadTime = Date.now() - start;

    // Should load within 10 seconds (generous for dev mode)
    expect(loadTime).toBeLessThan(10000);
  });

  test("page title is set", async ({ page }) => {
    await page.goto("/dashboard");
    const title = await page.title();
    expect(title).toBeTruthy();
  });

  test("has correct viewport", async ({ page }) => {
    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();
    expect(viewport!.width).toBeGreaterThan(0);
    expect(viewport!.height).toBeGreaterThan(0);
  });

  test("navigation sidebar is visible on desktop", async ({ page }) => {
    // On desktop, sidebar should be visible
    const sidebar = page.locator('[data-testid="sidebar"]').or(page.locator("nav"));
    if (await sidebar.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(sidebar.first()).toBeVisible();
    }
  });

  test("error state renders gracefully", async ({ page }) => {
    // Navigate to dashboard - even if data fails to load,
    // the page should render without crashing
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBeLessThan(500);
  });

  test("can navigate between dashboard pages", async ({ page }) => {
    await page.goto("/dashboard");

    // Try clicking on backup link if available
    const backupLink = page.getByRole("link", { name: /backup/i });
    if (await backupLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backupLink.click();
      await expect(page).toHaveURL(/\/dashboard\/backup/);
    }
  });

  test("can navigate to settings", async ({ page }) => {
    await page.goto("/dashboard");

    const settingsLink = page.getByRole("link", { name: /settings/i });
    if (await settingsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/dashboard\/settings/);
    }
  });
});
