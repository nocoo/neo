import { test, expect } from "@playwright/test";

test.describe("App — BDD Smoke", () => {
  test("Given the app is running, When I visit the login page, Then I see the app title", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle(/.+/, { timeout: 15_000 });
  });
});
