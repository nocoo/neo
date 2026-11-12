/**
 * System0 slot definitions for the local gates (`.husky/pre-commit`,
 * `.husky/pre-push`).
 *
 * Slot semantics live in the system0-quality skill (v1.3.0); the CI wiring lives
 * in `.github/workflows/`. Keep the ids, names and stages here in sync with the
 * declaration in `scripts/quality/slot-status.json`.
 */

export type Stage = "pre-commit" | "pre-push";

export interface GateExpect {
  pattern: RegExp;
  label: string;
  min: number;
}

export interface GateStep {
  label: string;
  command: string;
  timeoutMs: number;
  expect?: GateExpect;
}

export interface GateContext {
  root: string;
  gitRoot: string;
  stage: Stage;
  contentSha: string | undefined;
  g1Range?: string;
}

export interface SlotDefinition {
  id: string;
  name: string;
  stages: Stage[];
  target: string;
  steps?: GateStep[];
  stepsFor?: (ctx: GateContext) => GateStep[];
  stagedOnly?: RegExp;
}

/** Governance targets: pre-commit 15s, pre-push 150s. */
export const STAGE_TARGET_MS: Record<Stage, number> = {
  "pre-commit": 15_000,
  "pre-push": 150_000,
};

/** Hard budgets. Exceeding them blocks the gate. */
export const STAGE_BUDGET_MS: Record<Stage, number> = {
  "pre-commit": 30_000,
  "pre-push": 300_000,
};

const STEP_TIMEOUT_MS = 240_000;

export const SLOTS: SlotDefinition[] = [
  {
    id: "S1",
    name: "S1: Types",
    stages: ["pre-commit", "pre-push"],
    target: "root + worker TypeScript (tsc --noEmit)",
    steps: [{ label: "typecheck", command: "bun run typecheck", timeoutMs: STEP_TIMEOUT_MS }],
  },
  {
    id: "S2",
    name: "S2: Lint",
    stages: ["pre-commit", "pre-push"],
    target: "Biome check-only (0 error / 0 warning)",
    steps: [{ label: "lint", command: "bun run lint", timeoutMs: STEP_TIMEOUT_MS }],
  },
  {
    id: "S3",
    name: "S3: Workflow",
    stages: ["pre-commit"],
    target: ".github/workflows/*.yml (actionlint + immutable base-ci pins)",
    stagedOnly: /^\.github\/workflows\//,
    steps: [
      {
        label: "workflow lint",
        command: "bun run scripts/quality/workflow-lint.ts",
        timeoutMs: STEP_TIMEOUT_MS,
      },
    ],
  },
  {
    id: "G1",
    name: "G1: Secrets",
    stages: ["pre-commit", "pre-push"],
    target: "git index snapshot (pre-commit) / pushed ref range (pre-push)",
    stepsFor: (ctx) => [
      {
        label: ctx.g1Range ? `range ${ctx.g1Range}` : "staged",
        command: ctx.g1Range
          ? `bun run scripts/quality/secrets.ts --range="${ctx.g1Range}"`
          : "bun run scripts/quality/secrets.ts --index-snapshot",
        timeoutMs: STEP_TIMEOUT_MS,
      },
    ],
  },
  {
    id: "L1",
    name: "L1: Unit",
    stages: ["pre-commit", "pre-push"],
    target: "root Vitest (>=95.5%) + worker Vitest (>=95%)",
    steps: [
      {
        label: "root coverage",
        command: "bun run test:coverage",
        timeoutMs: STEP_TIMEOUT_MS,
        expect: { pattern: /Tests\s+(\d+)\s+passed/, label: "passed tests", min: 1 },
      },
      {
        label: "worker coverage",
        command: "bun run --cwd worker test:coverage",
        timeoutMs: STEP_TIMEOUT_MS,
        expect: { pattern: /Tests\s+(\d+)\s+passed/, label: "passed tests", min: 1 },
      },
    ],
  },
  {
    id: "G2",
    name: "G2: Dependencies",
    stages: ["pre-push"],
    target: "osv-scanner over bun.lock + worker/bun.lock",
    steps: [
      {
        label: "osv-scanner",
        command: "bun run test:security",
        timeoutMs: STEP_TIMEOUT_MS,
        expect: { pattern: /lockfiles scanned: (\d+)/, label: "scanned lockfiles", min: 2 },
      },
    ],
  },
  {
    id: "B1",
    name: "B1: Build",
    stages: ["pre-push"],
    target: "Next.js production bundle (next build --webpack)",
    steps: [{ label: "build", command: "bun run build", timeoutMs: STEP_TIMEOUT_MS }],
  },
  {
    id: "L3",
    name: "L3: Integration",
    stages: ["pre-push"],
    target: "real HTTP against the local Next.js server (memory adapter)",
    steps: [
      {
        label: "api e2e",
        command: "bun run test:e2e",
        timeoutMs: STEP_TIMEOUT_MS,
        expect: { pattern: /(\d+)\s+pass\b/, label: "passed tests", min: 1 },
      },
    ],
  },
  {
    id: "L4",
    name: "L4: E2E",
    stages: ["pre-push"],
    target: "Playwright chromium journeys",
    steps: [
      {
        label: "browser e2e",
        command: "bun run test:e2e:pw",
        timeoutMs: STEP_TIMEOUT_MS,
        expect: { pattern: /(\d+)\s+passed/, label: "passed tests", min: 1 },
      },
    ],
  },
];

/** Slots declared `na` for this project; recorded so the table stays honest. */
export const NOT_APPLICABLE: { id: string; name: string; reason: string }[] = [
  {
    id: "L2",
    name: "L2: Runtime",
    reason:
      "worker tests run in Node with a mocked Env binding (L1 evidence); no workerd or Miniflare runtime suite exists",
  },
  {
    id: "P1",
    name: "P1: Package",
    reason: "root package.json is private and nothing is published to npm",
  },
];

export function slotsForStage(stage: Stage): SlotDefinition[] {
  return SLOTS.filter((slot) => slot.stages.includes(stage));
}
