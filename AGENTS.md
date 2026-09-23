# Neo

Web authenticator for managing TOTP secrets, imports, recycle-bin records and encrypted backups.
Profile: ts-worker-web (Next.js on a server; D1 accessed over HTTP; optional OTP Worker).
Direction: [README.md](README.md), [backup contract](docs/02-backup-consolidation.md).

## Sources of Truth

Maintain root `AGENTS.md` as the only project handbook; do not create legacy aliases or copies. This file is the contract; hooks, CI and config enforce it. Raise weaker gates to meet it. The framework-owned footer below may be regenerated; preserve the handbook around it.

| Fact | Where |
| --- | --- |
| Human docs | [README.md](README.md), [docs/README.md](docs/README.md) |
| Version | Root `package.json`; Worker is independently versioned |
| Enforcement | `.husky/`, CI, root/Worker Vitest configs |
| Environment | Ignored `.env.local`; no root example exists; Worker has `wrangler.toml.example` |
| Accidents | [Retrospective.md](Retrospective.md) |

## Project Invariants

- Google authentication and the email allowlist protect per-user D1 records; an empty `ALLOWED_EMAILS` rejects all logins. Never test against real user OTP secrets.
- Stored Base32 secrets are server-readable. AES-GCM protects exported ZIPs; its key is stored in D1. Do not claim end-to-end encryption or a complete offline vault.
- Preserve supported TOTP algorithms/digits/periods, import deduplication, recycle-bin versus permanent deletion, and Backy backup scope. HOTP fields do not mean the UI generates HOTP.
- Optional `worker/` OTP/favicon service is independently configured/deployed. Keep its D1 rate-limit schema; remove legacy cron config when provisioning a new copy because no scheduled handler exists.
- MVVM: models own OTP/import/backup logic, ViewModels own state without View/DOM imports, actions/routes orchestrate. Preserve Next/Webpack/Serwist compatibility.
- Always build after TypeScript, Next or bundler upgrades; typechecking alone does not verify Next path resolution or production output.

## Stack / Layout

| Component | Choice |
| --- | --- |
| Web | Next.js/React, TypeScript 7.0.2, Basalt, Serwist |
| Data | `lib/db/` D1 HTTP client; `drizzle/` and `migrations/` schema |
| Domain | `actions/`, `models/`, `viewmodels/`, `app/`, `components/` |
| Quality | Bun, Node 22.12+, Biome, Vitest, Playwright; separate Worker package |

## Commands

Run from root; CI currently pins Bun 1.4.2. Install both packages before typecheck.

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
bun run --cwd worker test:coverage
bun run test:e2e
bunx playwright install chromium
bun run test:e2e:pw
bun run test:security
```

Normal dev needs `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `ALLOWED_EMAILS`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`; apply README's four schema files to the intended database before use. HTTP tests use `E2E_SKIP_AUTH=true` and in-memory storage; never supply real D1 credentials. Confirm 17026 is free first: the current runner forcibly kills port owners.

## Verification

6DQ retains its name with unified L1, L2/L3, G2 and D1; former G1 merged into L1 on 2026-09-21. Follow the maintained `system0-6dq-l1` contract. Status: `enforced`, `planned`, `manual`, `N/A`. No focused/skipped tests; preserve the stricter Web L1 contract of all four metrics ≥95.5% (Worker ≥95%).

| Piece | Requirement and current reality | Status | Evidence |
| --- | --- | --- | --- |
| L1 Web coverage | Four metrics ≥95.5% | enforced | Root Vitest, index-snapshot pre-commit and CI |
| L1 Worker coverage | Four metrics ≥95% | enforced | Worker Vitest coverage thresholds; CI Worker job runs `test:coverage` |
| L2 | Every endpoint/method over real HTTP and real SQL | planned | Pre-push `test:e2e` uses memory adapter; CI labels mocked `test:api` as L2 |
| L3 | Authenticated OTP/import/backup journeys | planned | CI Playwright currently checks login-page smoke only |
| Complete L1 | Coverage above plus strict types, zero-warning/error check-only lint, installed index-snapshot hooks and proven rejection | planned | Types/Biome and check-only lint-staged are wired before the index snapshot. Full rejection and <30s timing evidence remain incomplete |
| G2 | Required OSV + gitleaks, both lockfiles | planned | `test:security` scans root lock and upstream range, not pushed refs/all lane locks |
| D1 | Per-run local database/build/browser state, fail on occupied ports | planned | HTTP uses memory; `.next-e2e` is fixed and runner kills port owners; browser may reuse dev server |
| Build | Next/Webpack/Serwist output | enforced | CI preparation `build` |
| Docs | Current runtime and backup contracts | manual | Review linked docs |

Pre-commit skips heavy gates for docs; code changes run lint-staged before snapshotting the index for unit coverage/types. Pre-push runs HTTP then security against worktree/upstream. Target: check-only index L1 <30s and stdin-ref L2/G2 in parallel <3min. No commit/branch-push bypass, no lowered thresholds.

## Resources / Isolation

| Purpose | Port / resource | Current reality |
| --- | --- | --- |
| Dev | 7026; real configured D1 | Never a fixture database |
| L2 | 17026, `.next-e2e`, in-memory adapter | Local HTTP; real-SQL and non-destructive port guard gaps |
| L3 | 27026 | Login smoke; dedicated state/auth journey gap |

Future D1-backed tests need local Wrangler/Miniflare, per-run SQLite and test context/`_test_marker` before writes/cleanup. Do not create remote `-test` resources. Preserve other worktrees and running servers.

## Operations / Release

Use the existing Docker/CI release workflow for an authorized app release; optional Worker deployment is separate. Apply schema before dependent code, verify running `/api/live`, and use [README](README.md) plus [backup guide](docs/02-backup-consolidation.md) for configuration. This repo has no root release script.

## Retrospective

Full prior incidents are in [Retrospective.md](Retrospective.md). Keep only short project rules here; global lessons go to nmem/rules and deterministic checks to hooks/tests.

- Preserve trigger-only effect dependencies during lint changes; include Worker dependency installation whenever checks cross packages.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
