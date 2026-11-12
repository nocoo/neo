# Neo

Web authenticator for managing TOTP secrets, imports, recycle-bin records and encrypted backups.
Profile: ts-worker-web (Next.js on a server; D1 accessed over HTTP; optional OTP Worker).
Direction: [README.md](README.md), [backup contract](docs/02-backup-consolidation.md).

## Sources of Truth

Maintain root `AGENTS.md` as the only project handbook; do not create legacy aliases or copies. This file is the contract; hooks, CI and config enforce it. Raise weaker gates to meet it. The framework-owned footer below may be regenerated; preserve the handbook around it.

| Fact        | Where                                                                            |
| ----------- | -------------------------------------------------------------------------------- |
| Human docs  | [README.md](README.md), [docs/README.md](docs/README.md)                         |
| Version     | Root `package.json`; Worker is independently versioned                           |
| Enforcement | `.husky/`, `scripts/quality/`, `quality-slots.yml`, root/Worker Vitest configs   |
| Environment | Ignored `.env.local`; no root example exists; Worker has `wrangler.toml.example` |
| Accidents   | [Retrospective.md](Retrospective.md)                                             |

## Project Invariants

- Google authentication and the email allowlist protect per-user D1 records; an empty `ALLOWED_EMAILS` rejects all logins. Never test against real user OTP secrets.
- Stored Base32 secrets are server-readable. AES-GCM protects exported ZIPs; its key is stored in D1. Do not claim end-to-end encryption or a complete offline vault.
- Preserve supported TOTP algorithms/digits/periods, import deduplication, recycle-bin versus permanent deletion, and Backy backup scope. HOTP fields do not mean the UI generates HOTP.
- Optional `worker/` OTP/favicon service is independently configured/deployed. Keep its D1 rate-limit schema; remove legacy cron config when provisioning a new copy because no scheduled handler exists.
- MVVM: models own OTP/import/backup logic, ViewModels own state without View/DOM imports, actions/routes orchestrate. Preserve Next/Webpack/Serwist compatibility.
- Always build after TypeScript, Next or bundler upgrades; typechecking alone does not verify Next path resolution or production output.

## Stack / Layout

| Component | Choice                                                               |
| --------- | -------------------------------------------------------------------- |
| Web       | Next.js/React, TypeScript 7.0.2, Basalt, Serwist                     |
| Data      | `lib/db/` D1 HTTP client; `drizzle/` and `migrations/` schema        |
| Domain    | `actions/`, `models/`, `viewmodels/`, `app/`, `components/`          |
| Quality   | Bun, Node 22.12+, Biome, Vitest, Playwright; separate Worker package |

## Commands

Run from root; CI pins Bun 1.4.4 and Node 26.12.1. Install both packages before typecheck.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run dev
bun run typecheck
bun run lint
bun run build
bun run test:unit:coverage
bun run test:api
bun run --cwd worker test
bun run test:coverage
bun run --cwd worker test:coverage
bun run test:e2e
bunx playwright install --with-deps chromium
bun run test:e2e:pw
bun run test:security
bun run check:hooks
```

Normal dev needs `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `ALLOWED_EMAILS`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`; apply README's four schema files to the intended database before use. HTTP tests use `E2E_SKIP_AUTH=true` and in-memory storage; never supply real D1 credentials. Confirm 17026 and 27026 are free first: both runners now fail instead of killing an occupant.

## Verification

System0 quality 1.3.0, native CI mode, base-ci v2026.15 (`777bbe4f9bacab8a91d8c01974480a6ee23d28e0`). `scripts/quality/slot-status.json` is the single declaration; the local gate, the native CI workflow and Z1 all read it. Status: `impl`, `na`, `todo`. No focused/skipped tests; Web coverage stays ≥95.5% on all four metrics and Worker coverage ≥95%.

| Slot            | Status | Command and check object                                                                                                                         | Stage                                           | Measured / evidence                                                   |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| S1 Types        | impl   | `bun run typecheck`: root `tsc`, scripts `tsc -p tsconfig.scripts.json`, Worker `tsc --noEmit`                                                   | pre-commit, pre-push, CI                        | 0.7–1.1s local                                                        |
| S2 Lint         | impl   | `bun run lint`: Biome check-only, 0 error / 0 warning                                                                                            | pre-commit, pre-push, CI                        | 0.2–0.3s local                                                        |
| S3 Workflow     | impl   | `bun run scripts/quality/workflow-lint.ts`: actionlint + full-SHA base-ci pins                                                                   | pre-commit when workflows are staged; CI always | 0.0s local                                                            |
| G1 Secrets      | impl   | `scripts/quality/secrets.ts`: gitleaks over the index snapshot, each pushed range, or tracked HEAD                                               | pre-commit, pre-push, CI                        | 0.3–0.6s local                                                        |
| G2 Dependencies | impl   | `bun run test:security`: osv-scanner over `bun.lock` + `worker/bun.lock`                                                                         | pre-push, CI                                    | ~1.8s local; 2 lockfiles                                              |
| B1 Build        | impl   | `bun run build`: Next/Webpack/Serwist production output                                                                                          | pre-push, CI                                    | ~9.4s local                                                           |
| L1 Unit         | impl   | `bun run test:coverage` + `bun run --cwd worker test:coverage`                                                                                   | pre-commit, pre-push, CI                        | Web 97.57 / 95.75 / 95.90 / 98.60; Worker 99.43 / 97.65 / 100 / 99.40 |
| L2 Runtime      | na     | No separate workerd/Miniflare suite; Worker tests run in Node with a mocked `Env` binding and are counted as L1                                  | skipped in CI                                   | CI job remains skipped; `slot-status.json` requires it                |
| L3 Integration  | impl   | `bun run test:e2e`: real HTTP on 17026, memory adapter, 35 tests including create → encrypted export → decrypt → TOTP                            | pre-push, CI                                    | ~9s local                                                             |
| L4 E2E          | impl   | `bun run test:e2e:pw`: Playwright chromium on 27026                                                                                              | pre-push, CI                                    | 6 tests, ~15s local                                                   |
| P1 Package      | na     | Root `package.json` is private; no npm package is published                                                                                      | skipped in CI                                   | CI job remains skipped                                                |
| Z1 Gate         | impl   | Local `scripts/quality/gate.ts`; CI `scripts/quality/ci-gate.ts` validates declarations, the exact blocking-job set, success/skip and tested SHA | every gate, CI                                  | `check:hooks` covers 21 negative cases                                |

Pre-commit always runs the complete index snapshot (S1, S2, G1, L1, plus S3 when workflows are staged); pre-push exports every pushed OID and runs S1, S2, G1, L1, G2, B1, L3, L4 against it. `bun run check:hooks` proves staged and pushed fake-key blocking, per-slot failures, missing tools, timeouts, empty runs, lockfile drift, pushed-OID selection and deleted-ref skipping. Targets: pre-commit 15s (hard 30s), pre-push 150s (hard 300s), CI 5min (hard 10min). No hook bypass and no lowered thresholds.

## Resources / Isolation

| Purpose | Port / resource                       | Current reality                                                             |
| ------- | ------------------------------------- | --------------------------------------------------------------------------- |
| Dev     | 7026; real configured D1              | Never a fixture database                                                    |
| L3      | 17026, `.next-e2e`, in-memory adapter | Fails when the port is occupied; clears its lane dist dir per run           |
| L4      | 27026, `.next-e2e-pw`                 | Fails when the port is occupied; Playwright starts and stops its own server |

Both lanes use their own repo-local dist directory, so separate worktrees and servers do not share build state. Never kill another worktree's process. Future D1-backed runtime tests need local Wrangler/Miniflare and an isolated database; do not create remote `-test` resources.

## Operations / Release

Production is manual-only. `.github/workflows/release.yml` runs only from `workflow_dispatch`; the operator supplies the successful main-push CI run ID. base-ci v2026.15 `deploy-docker` proves that run's SHA and requires `quality / Z1: Gate` on the exact SHA before deploying jp4 `/data/neo`. A green CI run does not deploy by itself. Optional Worker deployment is separate. Apply schema before dependent code, verify `/api/live`, and use [README](README.md) plus [backup guide](docs/02-backup-consolidation.md) for configuration. This repo has no root release script.

## Retrospective

Full prior incidents are in [Retrospective.md](Retrospective.md). Keep only short project rules here; global lessons go to nmem/rules and deterministic checks to hooks/tests.

- Preserve trigger-only effect dependencies during lint changes; include Worker dependency installation whenever checks cross packages.
- Validate the index or pushed OID snapshot, never the working tree; a local hook must never kill a process it did not spawn.
- Keep the real fake-key injection in `bun run check:hooks`; a gitleaks allowlist must never replace the failure test.
- Mock Worker tests are L1. Do not relabel them as L2 Runtime without a real workerd/Miniflare suite.
- Keep production release manual. A successful CI run must not be able to deploy production.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
