import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
  ],
  esbuild: {
    // Optimize esbuild for faster transforms
    target: "esnext",
    minify: false,
  },
  optimizeDeps: {
    // Pre-bundle common dependencies
    include: ["react", "react-dom", "@testing-library/react"],
  },
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Disable console interception for faster output
    disableConsoleIntercept: true,
    // Optimize dependencies for faster imports
    deps: {
      optimizer: {
        web: {
          enabled: true,
        },
      },
    },
    // Use node environment for pure logic tests (faster, no jsdom overhead)
    environmentMatchGlobs: [
      ["tests/unit/models/**", "node"],
      ["tests/unit/lib/auth-*.test.ts", "node"],
      ["tests/unit/lib/d1-client.test.ts", "node"],
      ["tests/unit/lib/logger.test.ts", "node"],
      ["tests/unit/lib/mappers.test.ts", "node"],
      ["tests/unit/lib/db/scoped.test.ts", "node"],
      ["tests/unit/lib/utils.test.ts", "node"],
      ["tests/unit/lib/version.test.ts", "node"],
      ["tests/unit/lib/protocol-handler.test.ts", "node"],
      ["tests/unit/actions/**", "node"],
      ["tests/unit/middleware.test.ts", "node"],
      ["tests/unit/scripts/**", "node"],
    ],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/playwright/**", "tests/e2e/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      // AST-aware remapping is built into vitest v4+; no opt-in needed.
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
        // Third-party deps — not our code to cover
        "node_modules/",
        // Test files themselves — measured as source coverage, not target
        "tests/",
        // Build/tool config — no runtime logic worth measuring
        "**/*.config.*",
        // Type declarations — no executable code
        "**/*.d.ts",
        // Next.js build output — generated artifacts
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
        // Parens (route group syntax) are picomatch metachars — match the
        // dashboard page wrappers via a glob that ignores the (dashboard) segment.
        "**/dashboard/**/page.tsx",
        // Single-line auth delegation
        "actions/auth.ts",
        // Pure barrel re-export
        "lib/db/index.ts",
        // E2E-only in-memory adapter (exercised by HTTP E2E, not unit tests)
        "lib/e2e/",
        // Auth.js adapter (pure D1 delegation, same pattern as scoped.ts)
        "lib/auth-adapter.ts",
      ],
      // Global thresholds — All files must remain ≥95% on every metric.
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
