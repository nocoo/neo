#!/usr/bin/env bun
/**
 * L3: Integration — real HTTP requests against a locally started Next.js server.
 *
 * The server uses the in-memory E2E adapter, the lane's own dist directory and
 * dummy credentials. An occupied port fails before anything starts, and the
 * lane directory is cleared per run; this runner never kills a process it did
 * not spawn.
 */
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { assertPortFree } from "./port-guard";

const root = resolve(import.meta.dir, "..");
const port = 17026;
const baseUrl = `http://localhost:${port}`;
const distDir = ".next-e2e";
const distPath = join(root, distDir);
const readyTimeoutMs = 30_000;
const pollIntervalMs = 500;

function serverEnv(): Record<string, string> {
  return {
    ...process.env,
    NODE_ENV: "development",
    E2E_SKIP_AUTH: "true",
    NEXT_DIST_DIR: distDir,
    AUTH_SECRET: "neo-e2e-test-secret",
    AUTH_URL: baseUrl,
    AUTH_GOOGLE_ID: "",
    AUTH_GOOGLE_SECRET: "",
    ALLOWED_EMAILS: "e2e@test.local",
    CLOUDFLARE_ACCOUNT_ID: "",
    CLOUDFLARE_D1_DATABASE_ID: "",
    CLOUDFLARE_API_TOKEN: "",
  };
}

async function killTree(pid: number): Promise<void> {
  try {
    const children = Bun.spawn(["pgrep", "-P", String(pid)], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const text = await new Response(children.stdout).text();
    await children.exited;
    for (const child of text.split("\n").filter(Boolean)) {
      await killTree(Number(child));
    }
  } catch {
    // pgrep is unavailable; the direct signal below still applies
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // already gone
  }
}

async function stopServer(server: ReturnType<typeof Bun.spawn>): Promise<void> {
  if (server.exitCode !== null) return;
  await killTree(server.pid);
  const stopped = await Promise.race([
    server.exited.then(() => true),
    Bun.sleep(5_000).then(() => false),
  ]);
  if (!stopped) {
    try {
      process.kill(server.pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

async function waitForServer(server: ReturnType<typeof Bun.spawn>): Promise<void> {
  const deadline = Date.now() + readyTimeoutMs;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js server exited early with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/live`);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await Bun.sleep(pollIntervalMs);
  }
  throw new Error(`server failed to start within ${readyTimeoutMs / 1000}s`);
}

async function runTests(): Promise<number> {
  const proc = Bun.spawn(["bun", "test", "tests/e2e", "--timeout", "30000"], {
    cwd: root,
    env: { ...process.env, E2E_BASE_URL: baseUrl },
    stdout: "inherit",
    stderr: "inherit",
  });
  return proc.exited;
}

await assertPortFree(port);
rmSync(distPath, { recursive: true, force: true });
console.log(`▸ starting Next.js on ${baseUrl} (dist ${distDir})`);
const server = Bun.spawn(["bun", "next", "dev", "--webpack", "-p", String(port)], {
  cwd: root,
  env: serverEnv(),
  stdout: "inherit",
  stderr: "inherit",
});

let exitCode = 1;
try {
  await waitForServer(server);
  console.log("▸ server ready, running L3 tests");
  exitCode = await runTests();
} catch (error) {
  console.error(`L3 runner error: ${error instanceof Error ? error.message : String(error)}`);
} finally {
  await stopServer(server);
  rmSync(distPath, { recursive: true, force: true });
}

if (exitCode !== 0) {
  console.error("L3 integration tests failed");
  process.exit(exitCode || 1);
}
console.log("L3 integration tests passed");
