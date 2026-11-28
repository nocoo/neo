import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  oxc: {
    // Optimize OXC for faster transforms
    target: "esnext",
    minify: false,
  },
  optimizeDeps: {
    // Pre-bundle common dependencies
    include: ["react", "react-dom", "@testing-library/react"],
  },
  test: {
    allowOnly: false,
    passWithNoTests: false,
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Disable console interception for faster output
    disableConsoleIntercept: true,
    // Optimize dependencies for faster imports
    deps: {
      optimizer: {
        client: {
          enabled: true,
        },
      },
    },
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
        "**/index.ts",
        "**/types.ts",
        // View / UI layers — exercised by E2E
        "**/*.tsx",
        "components/**",
        "views/**",
        "pages/**",
        "contexts/**",
        "app/**",
        "main.tsx",
        "app.tsx",
        // Next.js build output — generated artifacts
        ".next/",
        // Config/schema/type-only files
        "lib/db/schema.ts",
        "models/types.ts",
        // Single-line auth delegation
        "actions/auth.ts",
        // Pure barrel re-export
        "lib/db/index.ts",
        // E2E-only in-memory adapter (exercised by HTTP E2E, not unit tests)
        "lib/e2e/",
        // Auth.js adapter (pure D1 delegation, same pattern as scoped.ts)
        "lib/auth-adapter.ts",
      ],
      // Global thresholds — 90% statements/functions/lines, 85% branches.
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 85,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
