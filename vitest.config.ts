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
    exclude: ["tests/playwright/**", "tests/e2e/**", "node_modules/**"],
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
        "components/sidebar.tsx",
        "components/app-shell.tsx",
        "components/sidebar-context.tsx",
        "components/breadcrumbs.tsx",
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
        // Auth.js adapter (pure D1 delegation, same pattern as scoped.ts)
        "lib/auth-adapter.ts",
      ],
      // Coverage thresholds per quality system L1 dimension
      thresholds: {
        "models/**": {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        "viewmodels/**": {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
        "actions/**": {
          lines: 85,
          functions: 85,
          branches: 75,
          statements: 85,
        },
        "lib/**": {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
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
