#!/usr/bin/env bun
/**
 * Local System0 gate runner — the local counterpart of CI's `Z1: Gate`.
 *
 * Every selected slot runs inside the snapshot under test, with its own
 * timeout. A failing slot, a missing scanner, a non-matching empty run, a
 * timeout or an exceeded stage budget fails the whole stage and prints the
 * reason per slot.
 *
 * Usage (from inside the snapshot root):
 *   bun scripts/quality/gate.ts --stage=pre-commit
 *   bun scripts/quality/gate.ts --stage=pre-push --g1-range=<remote-sha>..<local-sha>
 *   bun scripts/quality/gate.ts --stage=pre-push --only=B1,L3
 */
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  type GateContext,
  type GateStep,
  NOT_APPLICABLE,
  SLOTS,
  type SlotDefinition,
  STAGE_BUDGET_MS,
  STAGE_TARGET_MS,
  type Stage,
  slotsForStage,
} from "./slots";
import { checkBun, checkTool, type ToolCheck, type ToolKey } from "./tools";
import { formatDeclarationErrors, parseSlotStatus, validateSlotVersions } from "./z1";

const args = process.argv.slice(2);
const argValue = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

const stage = argValue("stage") as Stage | undefined;
const only = argValue("only");
const g1Range = argValue("g1-range");
const listOnly = args.includes("--list");

if (listOnly) {
  for (const candidate of ["pre-commit", "pre-push"] as Stage[]) {
    console.log(
      `${candidate}: ${slotsForStage(candidate)
        .map((slot) => slot.id)
        .join(", ")}`,
    );
  }
  process.exit(0);
}

if (stage !== "pre-commit" && stage !== "pre-push") {
  console.error("gate: --stage=pre-commit|pre-push is required");
  process.exit(2);
}

const root = resolve(import.meta.dir, "../..");
const gitRoot = process.env.GATE_GIT_ROOT ?? root;
const contentSha = process.env.GATE_CONTENT_SHA;
const scale = Number(process.env.GATE_TIMEOUT_SCALE ?? "1");
const timeoutScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
const startedAt = performance.now();
const budgetMs = STAGE_BUDGET_MS[stage] * timeoutScale;
const targetMs = STAGE_TARGET_MS[stage] * timeoutScale;

type Outcome = "pass" | "fail" | "timeout" | "skip";

interface StepResult {
  label: string;
  command: string;
  outcome: Outcome;
  ms: number;
  note: string;
  output: string;
}

interface SlotResult {
  slot: SlotDefinition;
  outcome: Outcome;
  ms: number;
  steps: StepResult[];
  note: string;
}

const selected = slotsForStage(stage).filter((slot) =>
  only ? only.split(",").includes(slot.id) : true,
);

const stagedPaths = (process.env.GATE_STAGED_FILES ?? "")
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const willRun = (slot: SlotDefinition) =>
  !slot.stagedOnly || stagedPaths.some((path) => slot.stagedOnly?.test(path));

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");

function formatMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
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
    // pgrep unavailable — the direct kill below still applies
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // already gone
  }
}

async function runStep(step: GateStep, timeoutMs: number): Promise<StepResult> {
  const started = performance.now();
  const proc = Bun.spawn(["/bin/sh", "-c", step.command], {
    cwd: root,
    env: { ...process.env },
    stdout: "pipe",
    stderr: "pipe",
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void killTree(proc.pid);
  }, timeoutMs);

  let output = "";
  const pump = async (stream: ReadableStream<Uint8Array> | undefined) => {
    if (!stream) return;
    const decoder = new TextDecoder();
    for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
      output += decoder.decode(chunk, { stream: true });
    }
  };
  await Promise.all([
    pump(proc.stdout as ReadableStream<Uint8Array>),
    pump(proc.stderr as ReadableStream<Uint8Array>),
  ]);
  const code = await proc.exited;
  clearTimeout(timer);
  const ms = performance.now() - started;

  if (timedOut) {
    return {
      label: step.label,
      command: step.command,
      outcome: "timeout",
      ms,
      note: `exceeded ${formatMs(timeoutMs)}`,
      output,
    };
  }
  if (code !== 0) {
    return {
      label: step.label,
      command: step.command,
      outcome: "fail",
      ms,
      note: `exit ${code}`,
      output,
    };
  }
  if (step.expect) {
    const plain = output.replace(ANSI, "");
    const matches = [...plain.matchAll(new RegExp(step.expect.pattern.source, "g"))];
    const count = matches.reduce((sum, match) => sum + Number(match[1] ?? 0), 0);
    if (count < step.expect.min) {
      return {
        label: step.label,
        command: step.command,
        outcome: "fail",
        ms,
        note: `empty run: ${count} ${step.expect.label} (need >= ${step.expect.min})`,
        output,
      };
    }
  }
  return { label: step.label, command: step.command, outcome: "pass", ms, note: "", output };
}

async function verifyLockfile(cwd: string): Promise<boolean> {
  const proc = Bun.spawn(["bun", "install", "--frozen-lockfile", "--dry-run"], {
    cwd,
    stdout: "ignore",
    stderr: "ignore",
  });
  const code = await proc.exited;
  return code === 0;
}

async function preflight(): Promise<boolean> {
  const checks: ToolCheck[] = [await checkBun(root)];

  const needed = new Set<ToolKey>();
  for (const slot of selected) {
    if (!willRun(slot)) continue;
    if (slot.id === "G1") needed.add("gitleaks");
    if (slot.id === "G2") needed.add("osv");
    if (slot.id === "S3") needed.add("actionlint");
  }
  for (const key of needed) {
    checks.push(await checkTool(key));
  }

  for (const dir of ["", "worker"]) {
    const base = join(root, dir);
    if (!existsSync(join(base, "package.json"))) continue;
    const frozen = await verifyLockfile(base);
    checks.push({
      name: `lockfile ${dir || "root"}`,
      ok: frozen,
      detail: frozen
        ? "frozen"
        : "bun install --frozen-lockfile --dry-run failed; run bun install and commit the lockfile",
    });
  }

  let ok = true;
  for (const check of checks) {
    console.log(`  ${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
    if (!check.ok) ok = false;
  }
  return ok;
}

function loadDeclaration(): string[] {
  const path = join(root, "scripts/quality/slot-status.json");
  if (!existsSync(path)) {
    return [`slot declaration missing: ${path}`];
  }
  const result = parseSlotStatus(readFileSync(path, "utf-8"));
  if (result.errors.length > 0) {
    return formatDeclarationErrors(result.errors).split("\n");
  }

  const problems: string[] = [];
  const declared = new Map(result.declarations.map((entry) => [entry.id, entry.status]));
  for (const slot of SLOTS) {
    const status = declared.get(slot.id);
    if (status && status !== "impl") {
      problems.push(`slot ${slot.id} is declared ${status} but the local gate runs it`);
    }
  }
  for (const entry of result.declarations) {
    if (entry.status !== "impl") continue;
    if (entry.id === "Z1") continue;
    if (!SLOTS.some((slot) => slot.id === entry.id)) {
      problems.push(`slot ${entry.id} is declared impl but the local gate has no slot for it`);
    }
  }
  return problems;
}

console.log(`▸ ${stage}: ${selected.map((slot) => slot.id).join(", ")}`);

const declarationProblems = loadDeclaration();
if (declarationProblems.length > 0) {
  console.error("❌ slot declaration is invalid:");
  for (const problem of declarationProblems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log("▸ preflight: toolchain and lockfiles");
if (!(await preflight())) {
  console.error(`\n❌ ${stage}: preflight failed`);
  process.exit(1);
}

if (stage === "pre-push" && !g1Range && selected.some((slot) => slot.id === "G1")) {
  console.error("gate: pre-push secret scanning requires --g1-range=<remote-sha>..<local-sha>");
  process.exit(2);
}

const context: GateContext = { root, gitRoot, stage, contentSha, g1Range };
const results: SlotResult[] = [];
let abortAfter: string | undefined;

for (const slot of selected) {
  if (abortAfter) {
    results.push({
      slot,
      outcome: "skip",
      ms: 0,
      steps: [],
      note: `not run after ${abortAfter} failed`,
    });
    continue;
  }

  const elapsed = performance.now() - startedAt;
  if (elapsed > budgetMs) {
    results.push({
      slot,
      outcome: "timeout",
      ms: 0,
      steps: [],
      note: `stage budget ${formatMs(budgetMs)} exceeded before this slot`,
    });
    continue;
  }

  if (slot.stagedOnly && !willRun(slot)) {
    results.push({
      slot,
      outcome: "skip",
      ms: 0,
      steps: [],
      note: "no staged change for this slot",
    });
    console.log(`\n▸ ${slot.name} — skipped (no staged change for ${slot.stagedOnly})`);
    continue;
  }

  const steps = slot.stepsFor?.(context) ?? slot.steps ?? [];
  console.log(`\n▸ ${slot.name} — ${slot.target}`);
  const slotStarted = performance.now();
  const stepResults: StepResult[] = [];

  for (const step of steps) {
    const remaining = budgetMs - (performance.now() - startedAt);
    const timeoutMs = Math.min(step.timeoutMs * timeoutScale, Math.max(remaining, 1));
    console.log(`  $ ${step.command}`);
    const result = await runStep(step, timeoutMs);
    stepResults.push(result);
    console.log(
      `  ${result.outcome === "pass" ? "✓" : "✗"} ${result.label} ${formatMs(result.ms)}${result.note ? ` — ${result.note}` : ""}`,
    );
    if (result.outcome !== "pass") {
      if (result.output.trim()) {
        console.error(result.output.trimEnd());
      }
      for (const rest of steps.slice(stepResults.length)) {
        stepResults.push({
          label: rest.label,
          command: rest.command,
          outcome: "skip",
          ms: 0,
          note: "not run",
          output: "",
        });
      }
      break;
    }
  }

  const failed = stepResults.find((step) => step.outcome === "fail" || step.outcome === "timeout");
  results.push({
    slot,
    outcome: failed ? failed.outcome : "pass",
    ms: performance.now() - slotStarted,
    steps: stepResults,
    note: failed?.note ?? "",
  });
  if (failed) abortAfter = slot.id;
}

const totalMs = performance.now() - startedAt;
const versions = results
  .filter((result) => result.outcome === "pass")
  .map((result) => ({ id: result.slot.id, sha: contentSha }));
const versionErrors = validateSlotVersions(versions);

console.log(`\n${"─".repeat(78)}`);
console.log(`System0 ${stage} gate — ${root}`);
console.log(`${"ID".padEnd(4)}${"SLOT".padEnd(17)}${"RESULT".padEnd(9)}${"TIME".padEnd(8)}TARGET`);
for (const result of results) {
  console.log(
    `${result.slot.id.padEnd(4)}${result.slot.name.slice(4).padEnd(17)}${result.outcome.toUpperCase().padEnd(9)}${formatMs(result.ms).padEnd(8)}${result.slot.target}`,
  );
}
for (const result of results) {
  if (result.note) console.log(`  ${result.slot.id}: ${result.note}`);
}
for (const entry of NOT_APPLICABLE) {
  console.log(
    `${entry.id.padEnd(4)}${entry.name.slice(4).padEnd(17)}${"N/A".padEnd(9)}${"-".padEnd(8)}${entry.reason}`,
  );
}
console.log(`${"─".repeat(78)}`);
console.log(
  `total ${formatMs(totalMs)} (target ${formatMs(targetMs)}, budget ${formatMs(budgetMs)})`,
);

const failedSlots = results.filter(
  (result) => result.outcome === "fail" || result.outcome === "timeout",
);

if (totalMs > budgetMs) {
  failedSlots.push({
    slot: { id: "budget", name: "stage budget", stages: [], target: "" },
    outcome: "timeout",
    ms: totalMs,
    steps: [],
    note: `stage took ${formatMs(totalMs)}, over the ${formatMs(budgetMs)} hard budget`,
  });
} else if (totalMs > targetMs) {
  console.warn(
    `\n⚠ ${stage} took ${formatMs(totalMs)}, over the ${formatMs(targetMs)} target (governance gap, within budget)`,
  );
}

if (versionErrors.length > 0) {
  console.error("\n❌ version validation failed:");
  for (const error of versionErrors) console.error(`  ${error}`);
  process.exit(1);
}

if (failedSlots.length > 0) {
  console.error(
    `\n❌ ${stage} gate failed: ${failedSlots.map((result) => `${result.slot.id} (${result.outcome}${result.note ? `: ${result.note}` : ""})`).join(", ")}`,
  );
  process.exit(1);
}

if (results.every((result) => result.outcome === "skip")) {
  console.error(`\n❌ ${stage} gate failed: no slot ran`);
  process.exit(1);
}

console.log(`\n✅ ${stage} gate passed`);
