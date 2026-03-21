import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/playwright/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: [
        "lib/**/*.ts",
        "models/**/*.ts",
        "actions/**/*.ts",
        "middleware.ts",
        "viewmodels/**/*.ts",
        "hooks/**/*.tsx",
        "components/app-sidebar.tsx",
        "components/dashboard-shell.tsx",
        "components/theme-toggle.tsx",
        "components/dashboard/**/*.tsx",
        "app/**/page.tsx",
      ],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.config.*",
        "**/*.d.ts",
        ".next/",
        // Config/schema/type-only files
        "lib/db/schema.ts",
        "models/types.ts",
        // Thin wrappers
        "app/api/auth/**",
        // Shadcn/UI auto-generated primitives
        "components/ui/",
        // Thin page wrappers (SSR data fetch → context → view, no testable logic)
        "app/page.tsx",
        "app/(dashboard)/**/page.tsx",
        // Single-line auth delegation
        "actions/auth.ts",
        // Pure barrel re-export
        "lib/db/index.ts",
      ],
      // Model layer thresholds (Phase 3 complete)
      thresholds: {
        "models/**": {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
