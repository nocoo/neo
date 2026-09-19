import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/bdd",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: "html",
  outputDir: "test-results",

  use: {
    baseURL: "http://localhost:27026",
    trace: "on-first-retry",
    headless: true,
  },

  webServer: {
    command: "bun run dev -- -p 27026",
    port: 27026,
    reuseExistingServer: false,
    timeout: 60_000,
    // Exercise the real layout with the existing test login and memory store.
    // Explicit empty credentials prevent .env.local from selecting real D1.
    env: {
      AUTH_SECRET: "neo-playwright-test-secret",
      AUTH_URL: "http://localhost:27026",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
      ALLOWED_EMAILS: "e2e@test.local",
      PLAYWRIGHT: "1",
      E2E_SKIP_AUTH: "true",
      CLOUDFLARE_ACCOUNT_ID: "",
      CLOUDFLARE_D1_DATABASE_ID: "",
      CLOUDFLARE_API_TOKEN: "",
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
