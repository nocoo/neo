#!/usr/bin/env bun
/**
 * L2: API E2E test runner — real HTTP requests against a running Next.js server.
 *
 * 1. Ensure port is free
 * 2. Start Next.js dev server with E2E_SKIP_AUTH=true
 * 3. Wait for server readiness (poll /api/live)
 * 4. Run bun:test E2E suite
 * 5. Cleanup server + build artifacts
 */

import { $ } from "bun";
import { rmSync } from "fs";

const E2E_PORT = 17026;
const BASE_URL = `http://localhost:${E2E_PORT}`;
const NEXT_DIST_DIR = ".next-e2e";
const MAX_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

// ── 1. Ensure port is free ───────────────────────────────────────────────────

async function ensurePortFree(): Promise<void> {
  try {
    const pids = await $`lsof -ti:${E2E_PORT}`.text();
    for (const pid of pids.trim().split("\n").filter(Boolean)) {
      console.log(`⚠️  Killing process ${pid} on port ${E2E_PORT}`);
      await $`kill -9 ${pid}`.quiet().nothrow();
    }
  } catch {
    // No process on port — good
  }
}

// ── 2. Start dev server ──────────────────────────────────────────────────────

function startServer(): ReturnType<typeof Bun.spawn> {
  console.log(`🚀 Starting Next.js dev server on port ${E2E_PORT}...`);
  return Bun.spawn(["bun", "next", "dev", "-p", String(E2E_PORT)], {
    cwd: import.meta.dir + "/..",
    env: {
      ...process.env,
      E2E_SKIP_AUTH: "true",
      NEXT_DIST_DIR,
    },
    stdout: "ignore",
    stderr: "ignore",
  });
}

// ── 3. Wait for readiness ────────────────────────────────────────────────────

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/live`);
      if (res.ok) {
        console.log("✅ Server is ready");
        return;
      }
    } catch {
      // Not ready yet
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Server failed to start within ${MAX_WAIT_MS / 1000}s`);
}

// ── 4. Run tests ─────────────────────────────────────────────────────────────

async function runTests(): Promise<boolean> {
  console.log("🧪 Running E2E tests...\n");
  try {
    await $`bun test tests/e2e --timeout 30000`.env({
      ...process.env,
      E2E_BASE_URL: BASE_URL,
    });
    return true;
  } catch {
    return false;
  }
}

// ── 5. Cleanup ───────────────────────────────────────────────────────────────

function cleanup(server: ReturnType<typeof Bun.spawn>): void {
  console.log("\n🧹 Cleaning up...");
  server.kill();
  try {
    rmSync(NEXT_DIST_DIR, { recursive: true, force: true });
  } catch {
    // Already gone
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

await ensurePortFree();
const server = startServer();

try {
  await waitForServer();
  const passed = await runTests();
  cleanup(server);
  if (!passed) {
    console.error("\n💀 L2 API E2E tests FAILED");
    process.exit(1);
  }
  console.log("\n✅ L2 API E2E tests passed");
} catch (err) {
  cleanup(server);
  console.error("\n💀 L2 API E2E runner error:", err);
  process.exit(1);
}
