import { expect, type Page, test } from "@playwright/test";

type Insets = { top: number; right: number; bottom: number; left: number };

// Browser emulators do not expose physical notch/home-indicator insets.
// Basalt's AppShell owns the safe-area padding for the authenticated shell
// ([data-basalt-shell]), while the login page (outside the shell) and the
// toaster keep their own env() offsets. Mirror those exact formulas with
// concrete pixel values, without adding test controls to production styles.
async function simulateInsets(page: Page, insets: Insets) {
  await page.addStyleTag({
    content: `
      [data-basalt-shell] {
        --basalt-safe-top: ${insets.top}px;
        --basalt-sticky-top: ${insets.top}px;
        padding: ${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px;
      }
      [data-basalt-sheet] [data-basalt-sidebar] {
        padding: ${insets.top}px ${insets.right}px ${insets.bottom}px ${insets.left}px;
      }
      [data-testid="login-edge-actions"] {
        top: calc(1rem + ${insets.top}px) !important;
        right: calc(1rem + ${insets.right}px) !important;
      }
      [data-testid="login-footer"] {
        padding-bottom: calc(1rem + ${insets.bottom}px) !important;
      }
    `,
  });
  // Sonner receives its bottom offset as a CSS expression through props.
  await page.locator("[data-sonner-toaster]").evaluateAll((elements, values) => {
    for (const element of elements) {
      const style = element.getAttribute("style") ?? "";
      element.setAttribute(
        "style",
        style.replace(/env\(safe-area-inset-bottom,\s*0px\)/g, `${values.bottom}px`),
      );
    }
  }, insets);
}

async function signIn(page: Page) {
  const csrf = await page.request.get("/api/auth/csrf");
  expect(csrf.ok()).toBe(true);
  const { csrfToken } = (await csrf.json()) as { csrfToken: string };
  const response = await page.request.post("/api/auth/callback/e2e-credentials", {
    form: { csrfToken, email: "e2e@test.local", name: "PWA Test User" },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Secrets");
}

test("PWA metadata is emitted in the page head", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('meta[name="mobile-web-app-capable"]')).toHaveAttribute(
    "content",
    "yes",
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
    "content",
    "Neo",
  );
  await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]')).toHaveAttribute(
    "content",
    "default",
  );
  const viewport = page.locator('meta[name="viewport"]');
  await expect(viewport).toHaveCount(1);
  await expect(viewport).toHaveAttribute("content", /width=device-width/);
  await expect(viewport).toHaveAttribute("content", /initial-scale=1/);
  await expect(viewport).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(viewport).not.toHaveAttribute("content", /user-scalable=no|maximum-scale=1/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#7c3aed");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("sizes", "180x180");
  await expect(page.locator('link[rel="apple-touch-startup-image"]')).toHaveCount(0);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
});

const zeroInsets: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
const layouts = [
  {
    name: "iPhone portrait",
    viewport: { width: 390, height: 844 },
    insets: { top: 59, right: 0, bottom: 34, left: 0 },
    mobile: true,
  },
  {
    name: "iPhone landscape",
    viewport: { width: 844, height: 390 },
    insets: { top: 0, right: 44, bottom: 21, left: 44 },
    mobile: true,
  },
  {
    name: "Android",
    viewport: { width: 412, height: 915 },
    insets: zeroInsets,
    mobile: true,
  },
  {
    name: "desktop",
    viewport: { width: 1440, height: 900 },
    insets: zeroInsets,
    mobile: false,
  },
];

for (const layout of layouts) {
  test.describe(layout.name, () => {
    test.use({ viewport: layout.viewport, isMobile: layout.mobile, hasTouch: layout.mobile });

    test("keeps edge controls reachable with browser and installed-app insets", async ({
      page,
    }) => {
      test.setTimeout(60_000);
      await page.goto("/");
      await expect(page.getByTestId("login-edge-actions")).toHaveCSS("top", "16px");
      await simulateInsets(page, layout.insets);
      await expect(page.getByTestId("login-edge-actions")).toHaveCSS(
        "top",
        `${16 + layout.insets.top}px`,
      );
      await expect(page.getByTestId("login-edge-actions")).toHaveCSS(
        "right",
        `${16 + layout.insets.right}px`,
      );
      await expect(page.getByTestId("login-footer")).toHaveCSS(
        "padding-bottom",
        `${16 + layout.insets.bottom}px`,
      );

      await signIn(page);
      const shell = page.locator("[data-basalt-shell]");
      const header = page.locator("[data-basalt-header]");
      const content = page.getByTestId("island-wrap");
      const isDrawer = layout.viewport.width < 768;
      // Zero insets keep the 56px header and the 8/12px island gutters.
      await expect(header).toHaveCSS("height", "56px");
      await expect(content).toHaveCSS("padding-left", isDrawer ? "8px" : "12px");
      await expect(content).toHaveCSS("padding-bottom", isDrawer ? "8px" : "12px");

      await simulateInsets(page, layout.insets);
      // The shell pays each safe-area inset exactly once.
      await expect(shell).toHaveCSS("padding-top", `${layout.insets.top}px`);
      await expect(shell).toHaveCSS("padding-right", `${layout.insets.right}px`);
      await expect(shell).toHaveCSS("padding-bottom", `${layout.insets.bottom}px`);
      await expect(shell).toHaveCSS("padding-left", `${layout.insets.left}px`);
      // The header stays 56px; the inset is paid by the shell, not the header.
      await expect(header).toHaveCSS("height", "56px");
      const headerBox = await header.boundingBox();
      expect(headerBox!.y).toBeGreaterThanOrEqual(layout.insets.top);
      await expect(page.locator("body")).toHaveCSS("padding-top", "0px");
      await expect(page.locator("body")).toHaveCSS("padding-bottom", "0px");

      if (isDrawer) {
        await page.getByRole("button", { name: "Open navigation" }).click();
      }
      const sidebar = page.locator("aside");
      await expect(sidebar).toBeVisible();
      await expect(sidebar).toHaveCSS("width", "260px");
      const signOut = await page
        .getByRole("button", { name: "Sign out", exact: true })
        .boundingBox();
      expect(signOut).not.toBeNull();
      expect(signOut!.y + signOut!.height).toBeLessThanOrEqual(
        layout.viewport.height - layout.insets.bottom,
      );
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.screenshot({ path: test.info().outputPath("safe-area.png") });
      if (isDrawer) {
        await page.getByRole("button", { name: "Close navigation" }).click();
        await expect(sidebar).toHaveCount(0);
      } else {
        await page.getByRole("button", { name: "Collapse sidebar", exact: true }).click();
        await expect(sidebar).toHaveCSS("width", "68px");
        const expand = await page
          .getByRole("button", { name: "Expand sidebar", exact: true })
          .boundingBox();
        expect(expand!.x).toBeGreaterThanOrEqual(layout.insets.left);
      }
    });
  });
}
