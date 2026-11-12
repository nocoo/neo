#!/usr/bin/env bun
/**
 * Fixed self-test for the local System0 gates.
 *
 * The real `.husky/pre-commit` and `.husky/pre-push` run against a throwaway git
 * repository whose slot commands are stubs. G1 uses the real gitleaks and a fake
 * AWS key built at runtime, so the staged-content scan and the pushed-range scan
 * are both proven to block. Every other slot is proven to block on failure, on a
 * missing tool, on a timeout, on an empty run and on lockfile drift.
 *
 * Usage: bun run scripts/verify-hooks.ts
 */
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { checkBun, declaredRuntimeVersion } from "./quality/tools";

const repoRoot = resolve(import.meta.dir, "..");
const ZERO = "0".repeat(40);

interface RunResult {
  code: number;
  output: string;
}

interface HookOptions {
  stdin?: string;
  env?: Record<string, string>;
}

const checks: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail = ""): void {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function tail(output: string, lines = 6): string {
  return output.trim().split("\n").slice(-lines).join(" | ").slice(0, 400);
}

async function run(
  command: string[],
  options: {
    cwd: string;
    stdin?: string | undefined;
    env?: Record<string, string>;
    timeoutMs?: number;
  } = {
    cwd: repoRoot,
  },
): Promise<RunResult> {
  const proc = Bun.spawn(command, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdin: options.stdin === undefined ? "ignore" : new TextEncoder().encode(options.stdin),
    stdout: "pipe",
    stderr: "pipe",
  });
  const timer = setTimeout(() => proc.kill("SIGKILL"), options.timeoutMs ?? 120_000);
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  clearTimeout(timer);
  return { code, output: `${out}\n${err}` };
}

function fakeAwsKey(): string {
  // The gitleaks aws-access-token rule matches AKIA + 16 characters from
  // [A-Z2-7], so the fake key is built from that alphabet at runtime.
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const suffix = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    const key = `AKIA${suffix}`;
    if (!/^AKIA[A-Z2-7]{16}$/.test(key)) {
      throw new Error("the fake AWS key is malformed");
    }
    if (shannonEntropy(key) >= 3.5) return key;
  }
  throw new Error("could not build a fake AWS key with enough entropy");
}

function shannonEntropy(value: string): number {
  const counts = new Map<string, number>();
  for (const character of value) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy += probability * Math.log2(probability);
  }
  return -entropy;
}

const tmpRoot = mkdtempSync(join(tmpdir(), "neo-gate-selftest-"));
const fixture = join(tmpRoot, "fixture");
const hookTmp = join(tmpRoot, "hook-tmp");
const controlDir = join(tmpRoot, "control");

function writeStub(name: string, mode: string): void {
  writeFileSync(join(controlDir, name), mode);
}

const STUB_SCRIPT = `const name = process.argv[2] ?? "unknown";
const dir = process.env.STUB_CONTROL_DIR;
let mode = "pass";
if (dir) {
  const file = Bun.file(\`\${dir}/\${name}\`);
  mode = (await file.exists()) ? (await file.text()).trim() : "pass";
}
if (mode === "fail") {
  console.error(\`\${name}: stub failure\`);
  process.exit(1);
}
if (mode === "empty") {
  process.exit(0);
}
if (mode === "sleep") {
  await Bun.sleep(120_000);
}
const markers = {
  "test-coverage": "Tests 3 passed (3)",
  "worker-coverage": "Tests 3 passed (3)",
  "test-security": "lockfiles scanned: 2 (bun.lock, worker/bun.lock)",
  "test-e2e": " 3 pass",
  "test-e2e-pw": " 3 passed (1.0s)",
};
console.log(markers[name] ?? \`\${name}: ok\`);
`;

const ROOT_PACKAGE = {
  name: "neo-gate-fixture",
  private: true,
  scripts: {
    typecheck: "bun run scripts/stub.ts typecheck",
    lint: "bun run scripts/stub.ts lint",
    build: "bun run scripts/verify-dep.ts && bun run scripts/stub.ts build",
    "test:coverage": "bun run scripts/stub.ts test-coverage",
    "test:e2e": "bun run scripts/stub.ts test-e2e",
    "test:e2e:pw": "bun run scripts/stub.ts test-e2e-pw",
    "test:security": "bun run scripts/stub.ts test-security",
  },
  dependencies: { dep: "file:./dep" },
};

const WORKER_PACKAGE = {
  name: "neo-worker-fixture",
  private: true,
  scripts: { "test:coverage": "bun run ../scripts/stub.ts worker-coverage" },
  dependencies: { dep: "file:../dep" },
};

const VERIFY_DEP_SCRIPT = `import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const control = process.env.STUB_CONTROL_DIR;
const expectedFile = control ? join(control, "expected-dep") : undefined;
if (expectedFile && existsSync(expectedFile)) {
  const expected = readFileSync(expectedFile, "utf-8").trim();
  const installed = JSON.parse(
    readFileSync(join(process.cwd(), "node_modules", "dep", "package.json"), "utf-8"),
  ).version;
  if (installed !== expected) {
    console.error(\`verify-dep: installed \${installed}, expected \${expected}\`);
    process.exit(1);
  }
}
`;

const WORKFLOW = `name: CI

on:
  push:
    branches: [main]

permissions:
  contents: read

env:
  BUN_VERSION: "1.4.4"

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          runtime-version: \${{ env.BUN_VERSION }}
`;

const UNPINNED_WORKFLOW = `name: Unpinned

on:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  quality:
    uses: nocoo/base-ci/.github/workflows/quality.yml@v2026.15
`;

function buildFixture(): void {
  mkdirSync(join(fixture, "scripts"), { recursive: true });
  mkdirSync(join(fixture, ".github", "workflows"), { recursive: true });
  mkdirSync(join(fixture, ".husky"), { recursive: true });
  mkdirSync(join(fixture, "dep"), { recursive: true });
  mkdirSync(join(fixture, "worker"), { recursive: true });
  mkdirSync(hookTmp, { recursive: true });
  mkdirSync(controlDir, { recursive: true });

  cpSync(join(repoRoot, "scripts", "quality"), join(fixture, "scripts", "quality"), {
    recursive: true,
  });
  cpSync(join(repoRoot, ".gitleaks.toml"), join(fixture, ".gitleaks.toml"));
  cpSync(join(repoRoot, ".husky", "pre-commit"), join(fixture, ".husky", "pre-commit"));
  cpSync(join(repoRoot, ".husky", "pre-push"), join(fixture, ".husky", "pre-push"));

  writeFileSync(join(fixture, "scripts", "stub.ts"), STUB_SCRIPT);
  writeFileSync(join(fixture, "scripts", "verify-dep.ts"), VERIFY_DEP_SCRIPT);
  writeFileSync(join(fixture, "package.json"), `${JSON.stringify(ROOT_PACKAGE, null, 2)}\n`);
  writeFileSync(
    join(fixture, "dep", "package.json"),
    `${JSON.stringify({ name: "dep", version: "1.0.0" }, null, 2)}\n`,
  );
  writeFileSync(
    join(fixture, "worker", "package.json"),
    `${JSON.stringify(WORKER_PACKAGE, null, 2)}\n`,
  );
  writeFileSync(join(fixture, ".github", "workflows", "ci.yml"), WORKFLOW);
  writeFileSync(join(fixture, ".gitignore"), "node_modules\ncoverage\n");
}

function toolPath(name: string): string | undefined {
  return Bun.which(name) ?? undefined;
}

function buildBinDir(name: string, exclude: string[] = []): string {
  const dir = join(tmpRoot, name);
  mkdirSync(dir, { recursive: true });
  const tools = [
    "bun",
    "git",
    "tar",
    "sh",
    "mktemp",
    "cmp",
    "ln",
    "rm",
    "mkdir",
    "cat",
    "cut",
    "pgrep",
    "awk",
    "sort",
    "wc",
    "tr",
    "date",
    "sleep",
    "osv-scanner",
    "actionlint",
    "gitleaks",
  ];
  for (const tool of tools) {
    if (exclude.includes(tool)) continue;
    const source = toolPath(tool);
    if (!source) continue;
    const target = join(dir, tool);
    if (existsSync(target)) continue;
    symlinkSync(source, target);
  }
  return dir;
}

let baseSha = "";

async function git(args: string[], cwd = fixture): Promise<RunResult> {
  const result = await run(["git", ...args], { cwd });
  if (result.code !== 0) {
    console.error(`git ${args.join(" ")} failed: ${tail(result.output)}`);
  }
  return result;
}

async function hook(
  kind: "pre-commit" | "pre-push",
  options: HookOptions = {},
): Promise<RunResult> {
  return run(["/bin/sh", join(fixture, ".husky", kind)], {
    cwd: fixture,
    stdin: options.stdin,
    env: { TMPDIR: hookTmp, STUB_CONTROL_DIR: controlDir, ...options.env },
  });
}

async function main(): Promise<void> {
  buildFixture();

  for (const args of [
    ["init", "-q", "-b", "main"],
    ["config", "user.email", "gate-selftest@example.invalid"],
    ["config", "user.name", "gate selftest"],
    ["config", "commit.gpgsign", "false"],
  ]) {
    await git(args);
  }

  const install = await run(["bun", "install"], { cwd: fixture });
  if (install.code !== 0) {
    console.error(`fixture install failed:\n${install.output}`);
    process.exit(1);
  }
  const workerInstall = await run(["bun", "install"], { cwd: join(fixture, "worker") });
  if (workerInstall.code !== 0) {
    console.error(`fixture worker install failed:\n${workerInstall.output}`);
    process.exit(1);
  }

  await git(["add", "-A"]);
  await git(["commit", "-qm", "fixture"]);
  baseSha = (await git(["rev-parse", "HEAD"])).output.trim().split("\n")[0] ?? "";

  const pushInput = (sha: string) => `refs/heads/main ${sha} refs/heads/main ${ZERO}\n`;

  // ── healthy baseline ───────────────────────────────────────────────────────
  const healthyCommit = await hook("pre-commit");
  check(
    "pre-commit passes on a healthy index",
    healthyCommit.code === 0,
    tail(healthyCommit.output),
  );

  const healthyPush = await hook("pre-push", { stdin: pushInput(baseSha) });
  check("pre-push passes on a healthy ref", healthyPush.code === 0, tail(healthyPush.output));

  // ── the pushed snapshot installs its own dependency versions ──────────────
  const depManifest = join(fixture, "dep", "package.json");
  writeFileSync(depManifest, `${JSON.stringify({ name: "dep", version: "2.0.0" }, null, 2)}\n`);
  const depInstall = await run(["bun", "install"], { cwd: fixture });
  if (depInstall.code !== 0) {
    console.error(`fixture dep install failed:\n${depInstall.output}`);
    process.exit(1);
  }
  await git(["add", "-A"]);
  await git(["commit", "-qm", "dep 2"]);
  const depSha = (await git(["rev-parse", "HEAD"])).output.trim().split("\n")[0] ?? "";
  await git(["reset", "--hard", "-q", baseSha]);
  const restoreInstall = await run(["bun", "install"], { cwd: fixture });
  if (restoreInstall.code !== 0) {
    console.error(`fixture restore install failed:\n${restoreInstall.output}`);
    process.exit(1);
  }

  writeStub("expected-dep", "2.0.0");
  const isolatedInstall = await hook("pre-push", {
    stdin: `refs/heads/main ${depSha} refs/heads/main ${baseSha}\n`,
  });
  rmSync(join(controlDir, "expected-dep"));
  check(
    "pre-push installs the pushed dependency version instead of reusing the worktree",
    isolatedInstall.code === 0 && !isolatedInstall.output.includes("verify-dep"),
    tail(isolatedInstall.output),
  );
  const worktreeDep = JSON.parse(
    readFileSync(join(fixture, "node_modules", "dep", "package.json"), "utf-8"),
  ).version;
  check(
    "pre-push leaves the worktree install untouched",
    worktreeDep === "1.0.0",
    `worktree dep ${worktreeDep}`,
  );

  // ── G1: staged content and pushed range ───────────────────────────────────
  const stagedSecret = join(fixture, "secret-probe.txt");
  writeFileSync(stagedSecret, `aws_access_key_id = ${fakeAwsKey()}\n`);
  await git(["add", "secret-probe.txt"]);
  const stagedBlock = await hook("pre-commit");
  check(
    "pre-commit blocks a staged secret (G1)",
    stagedBlock.code !== 0 && stagedBlock.output.includes("G1"),
    tail(stagedBlock.output),
  );
  await git(["rm", "-q", "--cached", "secret-probe.txt"]);
  rmSync(stagedSecret);

  writeFileSync(join(fixture, "leak.txt"), `aws_access_key_id = ${fakeAwsKey()}\n`);
  await git(["add", "leak.txt"]);
  await git(["commit", "-qm", "leak"]);
  const leakSha = (await git(["rev-parse", "HEAD"])).output.trim().split("\n")[0] ?? "";
  await git(["reset", "--hard", "-q", baseSha]);

  const rangeBlock = await hook("pre-push", {
    stdin: `refs/heads/leak ${leakSha} refs/heads/leak ${ZERO}\n`,
  });
  if (process.env.GATE_SELFTEST_DEBUG) {
    console.log(rangeBlock.output);
  }
  check(
    "pre-push blocks a pushed range with a secret (G1)",
    rangeBlock.code !== 0 && rangeBlock.output.includes("G1"),
    tail(rangeBlock.output),
  );
  check(
    "pre-push judges the pushed OID, not the current branch",
    rangeBlock.code !== 0 && !rangeBlock.output.includes("✅ pre-push gate passed"),
    tail(rangeBlock.output),
  );

  const twoRanges = await hook("pre-push", {
    stdin:
      `refs/heads/clean ${leakSha} refs/heads/clean ${leakSha}\n` +
      `refs/heads/dirty ${leakSha} refs/heads/dirty ${baseSha}\n`,
  });
  check(
    "pre-push scans G1 once per distinct range of the same OID",
    twoRanges.code !== 0 && twoRanges.output.includes("G1"),
    tail(twoRanges.output),
  );

  const remote = join(tmpRoot, "remote.git");
  const initRemote = await run(["git", "init", "--bare", "-q", remote], { cwd: tmpRoot });
  const fetchRemote = await run(
    ["git", "--git-dir", remote, "fetch", fixture, `${leakSha}:refs/heads/other`],
    { cwd: tmpRoot },
  );
  await git(["remote", "add", "origin", remote]);
  await git(["update-ref", "refs/remotes/origin/other", leakSha]);
  const newRefRemote = await hook("pre-push", {
    stdin: `refs/heads/new ${leakSha} refs/heads/new ${ZERO}\n`,
  });
  check(
    "pre-push scans the full pushed history when only unrelated remote refs contain it",
    initRemote.code === 0 &&
      fetchRemote.code === 0 &&
      newRefRemote.code !== 0 &&
      newRefRemote.output.includes("G1"),
    tail(newRefRemote.output),
  );

  // ── deleted refs are skipped ───────────────────────────────────────────────
  const deleted = await hook("pre-push", {
    stdin: `refs/heads/gone ${ZERO} refs/heads/gone ${ZERO}\n`,
  });
  check(
    "pre-push skips a deleted ref",
    deleted.code === 0 && deleted.output.includes("deletion"),
    tail(deleted.output),
  );

  // ── every slot blocks on its own failure ──────────────────────────────────
  const commitSlots: [string, string][] = [
    ["S1", "typecheck"],
    ["S2", "lint"],
    ["L1", "test-coverage"],
  ];
  for (const [slot, stub] of commitSlots) {
    writeStub(stub, "fail");
    const result = await hook("pre-commit");
    writeStub(stub, "pass");
    check(
      `${slot} blocks a failing slot`,
      result.code !== 0 && result.output.includes(slot),
      tail(result.output),
    );
  }

  const pushSlots: [string, string][] = [
    ["G2", "test-security"],
    ["B1", "build"],
    ["L3", "test-e2e"],
    ["L4", "test-e2e-pw"],
  ];
  for (const [slot, stub] of pushSlots) {
    writeStub(stub, "fail");
    const result = await hook("pre-push", { stdin: pushInput(baseSha) });
    writeStub(stub, "pass");
    check(
      `${slot} blocks a failing slot`,
      result.code !== 0 && result.output.includes(slot),
      tail(result.output),
    );
  }

  // ── S3 blocks an unpinned workflow reference ──────────────────────────────
  writeFileSync(join(fixture, ".github", "workflows", "unpinned.yml"), UNPINNED_WORKFLOW);
  await git(["add", ".github/workflows/unpinned.yml"]);
  const workflowBlock = await hook("pre-commit");
  check(
    "S3 blocks an unpinned base-ci reference",
    workflowBlock.code !== 0 && workflowBlock.output.includes("S3"),
    tail(workflowBlock.output),
  );
  await git(["rm", "-q", "--cached", ".github/workflows/unpinned.yml"]);
  rmSync(join(fixture, ".github", "workflows", "unpinned.yml"));

  // ── a missing tool blocks ──────────────────────────────────────────────────
  const withoutGitleaks = buildBinDir("bin-no-gitleaks", ["gitleaks"]);
  const missingTool = await hook("pre-commit", {
    env: { PATH: `${withoutGitleaks}:/usr/bin:/bin` },
  });
  check(
    "pre-commit blocks when gitleaks is missing",
    missingTool.code !== 0 && missingTool.output.includes("gitleaks"),
    tail(missingTool.output),
  );

  const withoutOsv = buildBinDir("bin-no-osv", ["osv-scanner"]);
  const missingScanner = await hook("pre-push", {
    stdin: pushInput(baseSha),
    env: { PATH: `${withoutOsv}:/usr/bin:/bin` },
  });
  check(
    "pre-push blocks when osv-scanner is missing",
    missingScanner.code !== 0 && missingScanner.output.includes("osv-scanner"),
    tail(missingScanner.output),
  );

  const withoutActionlint = buildBinDir("bin-no-actionlint", ["actionlint"]);
  const workflowPath = join(fixture, ".github", "workflows", "ci.yml");
  writeFileSync(workflowPath, `${WORKFLOW}# actionlint probe\n`);
  await git(["add", ".github/workflows/ci.yml"]);
  const missingActionlintResult = await hook("pre-commit", {
    env: { PATH: `${withoutActionlint}:/usr/bin:/bin` },
  });
  check(
    "pre-commit blocks when actionlint is missing",
    missingActionlintResult.code !== 0 && missingActionlintResult.output.includes("actionlint"),
    tail(missingActionlintResult.output),
  );
  await git(["restore", "--staged", "--worktree", ".github/workflows/ci.yml"]);

  // ── a timeout blocks ───────────────────────────────────────────────────────
  writeStub("typecheck", "sleep");
  const timeout = await hook("pre-commit", { env: { GATE_TIMEOUT_SCALE: "0.05" } });
  writeStub("typecheck", "pass");
  check(
    "pre-commit blocks a timed-out slot",
    timeout.code !== 0 && timeout.output.toLowerCase().includes("timeout"),
    tail(timeout.output),
  );

  // ── preparation time counts against the stage budget ──────────────────────
  const slowBin = buildBinDir("bin-slow-install", ["bun"]);
  const realBun = Bun.which("bun");
  if (!realBun) throw new Error("bun is not on PATH");
  writeFileSync(
    join(slowBin, "bun"),
    `#!/bin/sh\nif [ "$1" = "install" ]; then sleep 2; fi\nexec "${realBun}" "$@"\n`,
  );
  chmodSync(join(slowBin, "bun"), 0o755);
  const prepBudget = await hook("pre-commit", {
    env: { PATH: `${slowBin}:/usr/bin:/bin`, GATE_TIMEOUT_SCALE: "0.05" },
  });
  check(
    "pre-commit counts preparation against the stage budget",
    prepBudget.code !== 0 && prepBudget.output.includes("preparation alone took"),
    tail(prepBudget.output),
  );

  // ── an empty run blocks ────────────────────────────────────────────────────
  writeStub("test-coverage", "empty");
  const empty = await hook("pre-commit");
  writeStub("test-coverage", "pass");
  check(
    "pre-commit blocks an empty run",
    empty.code !== 0 && empty.output.includes("empty run"),
    tail(empty.output),
  );

  // ── lockfile drift between the pushed commit and the installed tree ───────
  const manifest = JSON.parse(readFileSync(join(fixture, "package.json"), "utf-8"));
  manifest.dependencies.other = "file:./other";
  writeFileSync(join(fixture, "package.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  mkdirSync(join(fixture, "other"), { recursive: true });
  writeFileSync(
    join(fixture, "other", "package.json"),
    `${JSON.stringify({ name: "other", version: "1.0.0" }, null, 2)}\n`,
  );
  await git(["add", "-A"]);
  await git(["commit", "-qm", "drift"]);
  const driftSha = (await git(["rev-parse", "HEAD"])).output.trim().split("\n")[0] ?? "";
  await git(["restore", "--source", baseSha, "--staged", "--worktree", "."]);

  const drift = await hook("pre-push", { stdin: pushInput(driftSha) });
  check(
    "pre-push blocks when the pushed manifests drift from the installed tree",
    drift.code !== 0 && drift.output.includes("frozen install failed"),
    tail(drift.output),
  );

  // ── the Bun version declaration must resolve ──────────────────────────────
  const versionRoot = join(tmpRoot, "version-check");
  const workflows = join(versionRoot, ".github", "workflows");
  mkdirSync(workflows, { recursive: true });
  const workflowFile = join(workflows, "quality-slots.yml");
  const envReference = `$${"{{ env.BUN_VERSION }}"}`;
  writeFileSync(workflowFile, "name: check\n");
  const noRuntime = await checkBun(versionRoot);
  check(
    "the Bun check fails when CI declares no runtime-version",
    !noRuntime.ok && noRuntime.detail.includes("no runtime-version"),
    noRuntime.detail,
  );

  writeFileSync(workflowFile, `runtime-version: ${envReference}\n`);
  const unresolved = await checkBun(versionRoot);
  check(
    "the Bun check fails when the runtime-version reference does not resolve",
    !unresolved.ok && declaredRuntimeVersion(versionRoot) === undefined,
    unresolved.detail,
  );

  writeFileSync(workflowFile, `env:\n  BUN_VERSION: "1.4.4"\nruntime-version: ${envReference}\n`);
  check(
    "the Bun check resolves env references in the CI runtime declaration",
    declaredRuntimeVersion(versionRoot) === "1.4.4",
    String(declaredRuntimeVersion(versionRoot)),
  );

  // ── the hooks clean up after themselves ────────────────────────────────────
  const leftovers = readdirSync(hookTmp);
  check(
    "the hooks remove their temporary directories",
    leftovers.length === 0,
    leftovers.join(", "),
  );
}

try {
  await main();
} catch (error) {
  check("the self-test ran to completion", false, String(error));
} finally {
  if (!process.env.GATE_SELFTEST_KEEP) {
    rmSync(tmpRoot, { recursive: true, force: true });
  } else {
    console.log(`fixture kept at ${tmpRoot}`);
  }
}

const failed = checks.filter((entry) => !entry.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} gate self-test cases passed`);
if (failed.length > 0) {
  console.error(`❌ failed cases: ${failed.map((entry) => entry.name).join(", ")}`);
  process.exit(1);
}
console.log("✅ the local System0 gates block what they must");
