# Neo

Web authenticator (Next.js/React, TypeScript 7, Basalt, Serwist; D1 over HTTP; optional independently versioned `worker/` OTP/favicon service) for TOTP secrets, imports, recycle-bin records, and encrypted backups.
Docs: [README.md](README.md) · [Docs Index](docs/README.md) · [Backup Contract](docs/02-backup-consolidation.md) · [Quality Contract](docs/06-system1-quality-migration.md) · [Retrospective](Retrospective.md)

## Commands

Run from root (Node 22.12+ locally; CI pins Bun 1.4.4 / Node 26.12.1). Install both root and `worker/` before typecheck.

```sh
bun install --frozen-lockfile
bun install --cwd worker --frozen-lockfile
bun run dev                        # https://neo.dev.hexly.ai -> 127.0.0.1:7026
bun run typecheck                  # S1: root tsc + tsconfig.scripts.json + worker tsc
bun run lint                       # S2: Biome check-only, 0 warnings
bun run build                      # B1: Next/Webpack/Serwist production output
bun run test:coverage              # L1 Web >= 80% all 4 metrics (subsets: test:unit:coverage, test:api)
bun run --cwd worker test:coverage # L1 Worker >= 80% all 4 metrics (fast: --cwd worker test)
bun run test:e2e                   # L3: real HTTP on 17026 (memory adapter; export -> decrypt -> TOTP)
bunx playwright install --with-deps chromium
bun run test:e2e:pw                # L4: Playwright Chromium on 27026
bun run test:security              # G2: osv-scanner over bun.lock + worker/bun.lock
bun run check:hooks                # Local gate self-test suite (29 cases)
```

No root `.env.example` exists (uses ignored `.env.local`); Worker uses `worker/wrangler.toml.example`. Dev requires `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL`, `ALLOWED_EMAILS`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_API_TOKEN`, plus README's four SQL schema files applied in order (startup never auto-migrates). HTTP/E2E tests use `E2E_SKIP_AUTH=true` and in-memory storage; never supply real D1 credentials.

## Invariants

- Google OAuth and `ALLOWED_EMAILS` protect per-user D1 records; empty `ALLOWED_EMAILS` rejects all logins. Never test against real user OTP secrets.
- Stored Base32 secrets are server-readable; AES-GCM encrypts exported ZIPs with a D1-stored key. Never claim end-to-end encryption or a complete offline vault.
- Preserve TOTP algorithms/digits/periods, import deduplication, recycle-bin vs permanent delete, and Backy backup scope. HOTP fields do not imply UI HOTP generation.
- Optional `worker/` OTP/favicon service is independently versioned and deployed; keep its D1 rate-limit schema and strip legacy cron config on new copies (no scheduled handler).
- MVVM: `models/` own OTP/import/backup logic, `viewmodels/` own state without View/DOM imports, and `actions/`/`app/` orchestrate (`lib/db/`, `drizzle/`, `migrations/` own D1 schema).
- Preserve Next/Webpack/Serwist compatibility; run `bun run build` after TS, Next, or bundler upgrades because typecheck alone misses path resolution and production output.
- Preserve trigger-only effect dependencies during lint edits (`biome-ignore` when needed); install `worker/` dependencies whenever checks cross packages.
- Local hooks validate index or pushed-OID snapshots (never working tree), never kill foreign processes, and keep real fake-key injection in `bun run check:hooks` (never allowlists).
- `.github/workflows/pipeline.yml` runs `quality` (`quality-slots.yml`) then D1–D5 Docker CD (`neo / production`, `ghcr.io/nocoo/neo` -> jp4 `/data/neo`) on `main` push or `workflow_dispatch` (`deploy=true`).
- No root release script; apply D1 schema before dependent code, verify `/api/live` after deploy, and deploy `worker/` separately.

## Quality & Local Gates

Follows `system1-quality`; CI slots and pinned `base-ci` (`v2026.24`) live in `.github/workflows/pipeline.yml` and `.github/workflows/quality-slots.yml` (`quality / Z1: Gate` required on `main`), with `scripts/quality/slot-status.json` as the single declaration. Full slot map and timings: [docs/06-system1-quality-migration.md](docs/06-system1-quality-migration.md). Status vocabulary: `enforced`, `planned`, `manual`, `N/A`.

- **Exceptions**: `L2 Runtime` is `N/A` (mocked-`Env` Worker tests count as `L1`, never `L2`, without workerd/Miniflare). `P1 Package` verifies the production Docker container (`/api/live`).
- **Thresholds**: no focused/skipped tests, hook bypasses, or lowered below-floor thresholds; Web coverage >= 80% (pure View components/pages excluded in `vitest.config.ts`) and Worker >= 80% on all four metrics.
- **Pre-commit (`.husky/`, via `prepare`)**: runs `S1/S2/G1/L1` (plus `S3` on staged workflows) on an isolated index snapshot (target 15s, hard 30s).
- **Pre-push (`.husky/`)**: runs `S1/S2/G1/L1/G2/B1/L3/L4` plus per-ref G1 ranges on exported pushed OIDs (target 150s, hard 300s).

## Resources & Isolation

| Lane | Endpoint / State                              | Boundary                                           |
| ---- | --------------------------------------------- | -------------------------------------------------- |
| Dev  | `127.0.0.1:7026` (`neo.dev.hexly.ai`), D1     | Daily local data; never fixture DB; keep server up |
| L3   | `127.0.0.1:17026`, `.next-e2e`, memory store  | Fails if occupied; clears lane dist dir per run    |
| L4   | `127.0.0.1:27026`, `.next-e2e-pw`, Playwright | Fails if occupied; Playwright manages its server   |
| Prod | `https://neo.hexly.ai`, jp4 `/data/neo`       | Read-only unless deployment is authorized          |

Repo-local lane dist dirs isolate worktrees; never kill another worktree's process. Future D1 runtime tests require local Wrangler/Miniflare and an isolated local database; never create remote `-test` resources.

## Retrospective

Record incident narratives in [Retrospective.md](Retrospective.md); promote recurring project constraints to `Invariants` above and enforceable safeguards to tests or hooks.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
