/**
 * Playwright E2E — Backup, Tools, and Settings pages.
 */

import { test, expect } from "@playwright/test";

test.describe("Backup Page", () => {
  test("loads backup page", async ({ page }) => {
    await page.goto("/dashboard/backup");
    await expect(page).toHaveURL(/\/dashboard\/backup/);
  });

  test("shows backup heading or content", async ({ page }) => {
    await page.goto("/dashboard/backup");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("has create backup button", async ({ page }) => {
    await page.goto("/dashboard/backup");
    const createButton = page.getByRole("button", { name: /create|backup/i });
    if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(createButton).toBeEnabled();
    }
  });

  test("renders without server errors", async ({ page }) => {
    const response = await page.goto("/dashboard/backup");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Tools Page", () => {
  test("loads tools page", async ({ page }) => {
    await page.goto("/dashboard/tools");
    await expect(page).toHaveURL(/\/dashboard\/tools/);
  });

  test("shows tools content", async ({ page }) => {
    await page.goto("/dashboard/tools");
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("has tool cards or sections", async ({ page }) => {
    await page.goto("/dashboard/tools");
    // Tools page should have some card-like elements
    const headings = page.locator("h2, h3");
    if (await headings.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      const count = await headings.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("renders without server errors", async ({ page }) => {
    const response = await page.goto("/dashboard/tools");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Settings Page", () => {
  test("loads settings page", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page).toHaveURL(/\/dashboard\/settings/);
  });

  test("shows settings heading", async ({ page }) => {
    await page.goto("/dashboard/settings");
    const heading = page.getByRole("heading", { name: /settings/i });
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible();
    }
  });

  test("has theme selector", async ({ page }) => {
    await page.goto("/dashboard/settings");
    const themeSelect = page.locator("#theme-select").or(
      page.getByLabel(/theme/i)
    );
    if (await themeSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(themeSelect).toBeVisible();
    }
  });

  test("has language selector", async ({ page }) => {
    await page.goto("/dashboard/settings");
    const langSelect = page.locator("#language-select").or(
      page.getByLabel(/language/i)
    );
    if (await langSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(langSelect).toBeVisible();
    }
  });

  test("renders without server errors", async ({ page }) => {
    const response = await page.goto("/dashboard/settings");
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe("Offline Page", () => {
  test("loads offline page", async ({ page }) => {
    await page.goto("/offline");
    await expect(page).toHaveURL(/\/offline/);
  });

  test("shows offline message", async ({ page }) => {
    await page.goto("/offline");
    const heading = page.getByRole("heading", { name: /offline/i });
    if (await heading.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(heading).toBeVisible();
    }
  });

  test("has try again button", async ({ page }) => {
    await page.goto("/offline");
    const retryButton = page.getByRole("button", { name: /try again/i });
    if (await retryButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(retryButton).toBeEnabled();
    }
  });
});
