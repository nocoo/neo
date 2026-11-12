# System0 Quality Migration

Neo now follows the System0 quality standard (1.3.0) with base-ci v2026.15 in native mode. The authoritative runtime contract is [AGENTS.md](../AGENTS.md); this document records the slot mapping, evidence, and remaining gaps.

## Slots

| Slot            | Status | Check                                                            | Stage                                |
| --------------- | ------ | ---------------------------------------------------------------- | ------------------------------------ |
| S1 Types        | impl   | Root `tsc`, `tsconfig.scripts.json`, Worker `tsc --noEmit`       | pre-commit, pre-push, CI             |
| S2 Lint         | impl   | Biome check-only                                                 | pre-commit, pre-push, CI             |
| S3 Workflow     | impl   | actionlint + full-SHA base-ci pins                               | pre-commit when workflows change, CI |
| G1 Secrets      | impl   | gitleaks over index snapshot / pushed range / tracked HEAD       | pre-commit, pre-push, CI             |
| G2 Dependencies | impl   | osv-scanner over `bun.lock` and `worker/bun.lock`                | pre-push, CI                         |
| B1 Build        | impl   | Next/Webpack/Serwist build                                       | pre-push, CI                         |
| L1 Unit         | impl   | Root and Worker Vitest coverage                                  | pre-commit, pre-push, CI             |
| L2 Runtime      | na     | Worker tests are Node + mocked `Env`; no workerd/Miniflare suite | skipped in CI                        |
| L3 Integration  | impl   | Real HTTP on 17026, memory adapter, 35 tests                     | pre-push, CI                         |
| L4 E2E          | impl   | Playwright chromium on 27026, 6 tests                            | pre-push, CI                         |
| P1 Package      | na     | Private root package; nothing is published                       | skipped in CI                        |
| Z1 Gate         | impl   | Local `gate.ts`; CI `ci-gate.ts`                                 | every gate, CI                       |

## Enforcement

- `scripts/quality/slot-status.json` is the single declaration. The local gate and `ci-gate.ts` both reject missing, duplicate, unknown, or illegally justified slots.
- `.github/workflows/ci.yml` only calls `quality-slots.yml`. The caller key is `quality`, so the required check is exactly `quality / Z1: Gate`.
- `ci-gate.ts` requires the exact blocking-job set: 12 slot jobs plus `Hook Self-Test` and `Container Smoke`. Implemented slots must succeed with the same `tested-sha` as `github.sha`; na slots must be skipped.
- `.github/workflows/release.yml` is `workflow_dispatch` only. It passes the operator's CI run ID to base-ci v2026.15 `deploy-docker` with `required-quality-check: "quality / Z1: Gate"`.
- L3 and L4 use repo-local lane dist directories, fail on an occupied port, and never kill another process.

## Evidence

Measured on macOS arm64, Bun 1.4.4, Node 26.13.0:

| Gate           | Result                                                                                |
| -------------- | ------------------------------------------------------------------------------------- |
| L1 Web         | Statements 97.57%, branches 95.75%, functions 95.90%, lines 98.60% (threshold 95.5%)  |
| L1 Worker      | Statements 99.43%, branches 97.65%, functions 100%, lines 99.40% (threshold 95%)      |
| L3             | 35 tests pass in ~9s                                                                  |
| L4             | 6 tests pass in ~15s                                                                  |
| B1             | ~9.4s                                                                                 |
| G2             | 2 lockfiles, 0 vulnerabilities, ~1.8s                                                 |
| Hook self-test | 29/29 cases pass                                                                      |
| Pre-commit     | 10.2–12.7s wall (gate 8.6–10.5s, prep 1–2s), target 15s, hard budget 30s              |
| Pre-push       | 46–52.8s wall (gate 43.5–49.3s), target 150s, hard budget 300s                        |
| CI             | 81s total on 02ad970; critical path L4 69s, then Z1 7s; 11 blocking jobs agree on SHA |

The recorded run is [43174856476](https://github.com/nocoo/neo/actions/runs/43174856476); its required check is exactly `quality / Z1: Gate`. Every CI job has a 10-minute hard timeout; the workflow has no separate whole-run cap, so total wall time is the slowest job plus queue time. Branch protection requires only `quality / Z1: Gate` (strict=false, force-push and deletion blocked, admin bypass).

## Remaining Gaps

- L2 Runtime stays `na` until a real workerd/Miniflare suite exists.
- The checked-in local L3 lane still uses the in-memory adapter; a D1-backed SQL lane needs local Wrangler/Miniflare and an isolated database.
- L4 currently covers the login page and PWA smoke journeys; expand only with a concrete product risk.
