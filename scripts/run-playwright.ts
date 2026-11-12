#!/usr/bin/env bun
/**
 * L4: E2E — Playwright with the lane's own Next.js dist directory.
 *
 * Playwright owns the dev server and stops it itself. This wrapper only picks an
 * isolated build directory and removes it after the run.
 */
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertPortFree } from "./port-guard";

const root = resolve(import.meta.dir, "..");
const port = 27026;
const distDir = ".next-e2e-pw";

await assertPortFree(port);
rmSync(join(root, distDir), { recursive: true, force: true });

const proc = Bun.spawn(["bun", "x", "playwright", "test", ...process.argv.slice(2)], {
  cwd: root,
  env: { ...process.env, NEXT_DIST_DIR: distDir },
  stdout: "inherit",
  stderr: "inherit",
});
const code = await proc.exited;
rmSync(join(root, distDir), { recursive: true, force: true });
process.exit(code);
