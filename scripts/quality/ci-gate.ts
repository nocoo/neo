#!/usr/bin/env bun
/**
 * Z1: Gate for the native CI slot workflow.
 *
 * GitHub only exposes the jobs listed in `needs`, so this gate owns the exact
 * blocking-job set: every declared slot, every blocking job outside the slot
 * list, and nothing else. Implemented slots must succeed with the same
 * tested-sha as the run; na/todo slots must be skipped.
 */
import { appendFileSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatDeclarationErrors,
  parseSlotStatus,
  SLOT_IDS,
  type SlotDeclaration,
  type SlotId,
} from "./z1";

export interface NeedEntry {
  result?: string;
  outputs?: Record<string, string>;
}

export type Needs = Record<string, NeedEntry>;

export const SLOT_JOBS: Record<SlotId, string> = {
  S1: "s1-types",
  S2: "s2-lint",
  S3: "s3-workflow",
  G1: "g1-secrets",
  G2: "g2-dependencies",
  B1: "b1-build",
  L1: "l1-unit",
  L2: "l2-runtime",
  L3: "l3-integration",
  L4: "l4-e2e",
  P1: "p1-package",
  Z1: "z1-gate",
};

/** Blocking jobs that are not quality slots. Their names must not carry a slot id. */
export const EXTRA_JOBS = ["hook-self-test", "container-smoke"] as const;

export interface CiGateInput {
  needs: Needs;
  declarations: SlotDeclaration[];
  expectedSha: string;
}

export interface CiGateResult {
  errors: string[];
  verified: { job: string; slot?: SlotId; sha: string }[];
}

const SHA_PATTERN = /^[0-9a-f]{40}$/;

function testedSha(entry: NeedEntry | undefined): string {
  return entry?.outputs?.["tested-sha"] ?? "";
}

function verifyRun(
  job: string,
  entry: NeedEntry | undefined,
  expectedSha: string,
  errors: string[],
): string | undefined {
  if (!entry) {
    errors.push(`Z1 has no result for blocking job ${job}`);
    return undefined;
  }
  if (entry.result !== "success") {
    errors.push(`${job} finished ${entry.result ?? "without a result"}, not success`);
  }
  const sha = testedSha(entry);
  if (!SHA_PATTERN.test(sha)) {
    errors.push(`${job} did not report a valid tested-sha`);
    return undefined;
  }
  if (sha !== expectedSha) {
    errors.push(`${job} tested ${sha} while CI checked out ${expectedSha}`);
  }
  return sha;
}

export function verifyCiGate(input: CiGateInput): CiGateResult {
  const errors: string[] = [];
  const verified: CiGateResult["verified"] = [];
  const { needs, declarations, expectedSha } = input;

  if (!SHA_PATTERN.test(expectedSha)) {
    return { errors: [`expected commit sha is invalid: "${expectedSha}"`], verified };
  }
  if (!needs || typeof needs !== "object" || Array.isArray(needs)) {
    return { errors: ["Z1 received no job results"], verified };
  }

  const declared = new Map(declarations.map((entry) => [entry.id, entry]));
  const known = new Set<string>();

  for (const id of SLOT_IDS) {
    if (id === "Z1") continue;
    const job = SLOT_JOBS[id];
    known.add(job);
    const declaration = declared.get(id);
    if (!declaration) {
      errors.push(`slot ${id} has no declaration`);
      continue;
    }
    const entry = needs[job];
    if (!entry) {
      errors.push(`Z1 has no result for slot ${id} (${job})`);
      continue;
    }
    if (declaration.status === "impl") {
      const sha = verifyRun(job, entry, expectedSha, errors);
      if (sha) verified.push({ job, slot: id, sha });
      continue;
    }
    if (entry.result !== "skipped") {
      errors.push(
        `${id} is declared ${declaration.status} but ${job} finished ${entry.result ?? "without a result"}`,
      );
    }
  }

  for (const job of EXTRA_JOBS) {
    known.add(job);
    const sha = verifyRun(job, needs[job], expectedSha, errors);
    if (sha) verified.push({ job, sha });
  }

  for (const job of Object.keys(needs)) {
    if (!known.has(job)) {
      errors.push(`unexpected blocking job in Z1 needs: ${job}`);
    }
  }

  return { errors, verified };
}

function fail(message: string): never {
  console.error(`::error::${message}`);
  process.exit(1);
}

function main(): void {
  const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
  const declarationPath = join(root, "scripts", "quality", "slot-status.json");
  const declaration = parseSlotStatus(readFileSync(declarationPath, "utf-8"));
  if (declaration.errors.length > 0) {
    fail(`slot declaration is invalid:\n${formatDeclarationErrors(declaration.errors)}`);
  }

  const expectedSha = process.env.EXPECTED_SHA ?? "";
  let needs: Needs;
  try {
    needs = JSON.parse(process.env.NEEDS_JSON ?? "null") as Needs;
  } catch (error) {
    fail(`Z1 received invalid needs JSON: ${(error as Error).message}`);
  }
  if (!needs) fail("Z1 received no job results");

  const result = verifyCiGate({
    needs,
    declarations: declaration.declarations,
    expectedSha,
  });
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(`::error::${error}`);
    process.exit(1);
  }

  const lines = result.verified.map(
    (entry) =>
      `PASS ${entry.slot ? `${entry.slot} ${entry.job}` : entry.job} tested ${entry.sha.slice(0, 12)}`,
  );
  for (const line of lines) console.log(line);
  console.log(`Z1: ${result.verified.length} blocking jobs agree on ${expectedSha}`);

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `tested-sha=${expectedSha}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `\n## Z1: Gate\n\n${lines.map((line) => `- ${line}`).join("\n")}\n`,
    );
  }
}

if (import.meta.main) {
  main();
}
