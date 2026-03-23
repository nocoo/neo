# Quality System V2 Upgrade: True L2 + D1 Verification

Re-evaluate Neo against the canonical six-dimension quality system specification (memory `af0daa0f`).
The previous upgrade (doc 04) declared Tier S, but an honest audit reveals **L2 is non-compliant** —
the "API E2E" tests import Server Actions directly in vitest with `MockScopedDB`, making zero real
HTTP requests. The spec mandates: _"真实网络调用，非 mock import handler...必须走真 HTTP...
自定义 run-e2e.ts 脚本，自动启停 dev server"_.

## Honest Re-Assessment

| Dimension | Declared (doc 04) | Actual | Gap |
|-----------|-------------------|--------|-----|
| **L1** Unit/Component | ✅ Tier S | ✅ **True** | 937+ tests, 95%+ coverage, 4-layer thresholds, pre-commit gated |
| **L2** Integration/API | ✅ Tier S | ❌ **Non-compliant** | `tests/api/` uses `import { createSecret } from "@/actions/secrets"` + `MockScopedDB` (in-memory arrays). Zero `fetch()` calls, no dev server, no HTTP layer |
| **L3** System/E2E | ✅ Tier S | ✅ **True** | 35+ Playwright specs with real browser + real HTTP to dev server |
| **G1** Static Analysis | ✅ Tier S | ✅ **True** | `tsc --noEmit` (strict) + ESLint `error` severity + `--max-warnings=0` in pre-commit |
| **G2** Security | ✅ Tier S | ✅ **True** | `osv-scanner` + `gitleaks` in pre-push |
| **D1** Test Isolation | ⚠️ N/A | ⚠️ **Partial** | `wrangler.toml.example` has `[env.test]` but no three-layer verification mechanism (no `verify-test-bindings.ts`, no runtime `RESOURCE_ENV` check, no `_test_marker` table) |

### True Tier: **B** (L1 + G1 pass; L2 fails → cannot reach A)

### Target Tier: **S** (all six dimensions green)

---

## Gap Detail

### L2: Mock-based → True HTTP

**Current architecture** (non-compliant):
```
vitest process
  └─ import { createSecret } from "@/actions/secrets"
       └─ vi.mock("@/lib/auth-context") → MockScopedDB (in-memory array)
```

**Target architecture** (spec-compliant):
```
vitest process
  └─ fetch("http://localhost:13042/api/...")    ← real HTTP
       └─ Next.js dev server (auto-started)
            └─ Server Action / Route Handler
                 └─ ScopedDB → D1-test (or mock D1 for HTTP-only validation)
```

**Specific gaps**:

| # | Gap | Resolution |
|---|-----|------------|
| 1 | No `run-e2e.ts` script | Create `scripts/run-e2e.ts` — auto-start dev server on port 13042, wait for ready, run tests, auto-stop |
| 2 | No real HTTP test client | Use `fetch()` or lightweight HTTP client in tests against `http://localhost:13042` |
| 3 | Auth in test mode | Reuse Playwright's `PLAYWRIGHT=1` Credentials provider approach — POST to `/api/auth/callback/credentials` to get session cookie |
| 4 | 0/8 Route Handlers tested | All route handlers (`/api/backup/*`, `/api/backy/pull`, `/api/health`, `/api/live`) need HTTP-level tests |
| 5 | 0/7 Backy actions tested | Backy actions need integration coverage via their HTTP trigger paths |
| 6 | Port convention | Spec: dev=7042, API E2E=13042, BDD E2E=27042 (current Playwright uses 27042 ✅) |

### D1: Config-only → Three-Layer Verification

**Current state**: `wrangler.toml.example` has `[env.test]` section (config exists), but none of the three verification layers are implemented.

**Spec requires** (memory `af0daa0f`):

| # | Verification Layer | Current | Target |
|---|-------------------|---------|--------|
| 1 | Build-time binding verification | ❌ Missing | `scripts/verify-test-bindings.ts` — parse `wrangler.toml [env.test]`, assert all bindings contain `-test` suffix, non-zero exit blocks pipeline |
| 2 | Runtime resource name check | ❌ Missing | Test setup checks `RESOURCE_ENV === "test"`, throws if mismatch |
| 3 | Test data marker table | ❌ Missing | `_test_marker` table in test D1 (`key=env, value=test`), verified before any reset |

**D1 applicability assessment**:
- Main app: D1 access is via HTTP through Worker → isolation at Worker level
- Worker: Direct D1 binding → D1 fully applicable
- Decision: D1 verification applies to **Worker sub-package only**; main app's isolation is achieved by mocking the Worker HTTP interface

---

## Implementation Plan

### Step 1: L2 Infrastructure — `run-e2e.ts` Script

**Goal**: Create the auto-start/stop dev server script per spec.

**File**: `scripts/run-e2e.ts`

```typescript
#!/usr/bin/env bun
/**
 * L2: API E2E test runner — auto-start dev server, run tests, auto-stop.
 * Port 13042 per quality system convention (dev=7042, API E2E=13042, BDD E2E=27042).
 */

import { $ } from "bun";

const PORT = 13042;
const BASE_URL = `http://localhost:${PORT}`;
const HEALTH_ENDPOINT = `${BASE_URL}/api/health`;
const MAX_WAIT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

async function waitForServer(): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < MAX_WAIT_MS) {
    try {
      const res = await fetch(HEALTH_ENDPOINT);
      if (res.ok) {
        console.log(`✅ Dev server ready at ${BASE_URL}`);
        return;
      }
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(POLL_INTERVAL_MS);
  }
  throw new Error(`Dev server did not start within ${MAX_WAIT_MS}ms`);
}

console.log(`🚀 L2: Starting dev server on port ${PORT}...`);

const server = Bun.spawn(
  ["bun", "run", "dev", "--", "-p", String(PORT)],
  {
    env: {
      ...process.env,
      E2E_API: "1",
      ALLOWED_EMAILS: "e2e@test.local",
    },
    stdout: "ignore",
    stderr: "ignore",
  }
);

try {
  await waitForServer();
  console.log("🧪 L2: Running API E2E tests...\n");
  await $`bun vitest run tests/api-e2e --reporter=verbose`.env({
    ...process.env,
    E2E_API_BASE_URL: BASE_URL,
  });
  console.log("\n✅ L2: API E2E tests passed");
} catch (e) {
  console.error("\n❌ L2: API E2E tests failed");
  process.exit(1);
} finally {
  server.kill();
  console.log("🛑 Dev server stopped");
}
```

**File**: `package.json` — update script:

```diff
- "test:api": "vitest run tests/api",
+ "test:api": "bun scripts/run-e2e.ts",
+ "test:api:mock": "vitest run tests/api",
```

> **Note**: The old mock-based tests are preserved as `test:api:mock` — they still provide fast feedback
> during development. The new `test:api` runs true HTTP E2E per spec.

#### Atomic commits

| # | Commit Message | Files |
|---|----------------|-------|
| 1 | `feat: add L2 run-e2e.ts script for auto dev server management` | `scripts/run-e2e.ts` |
| 2 | `refactor: remap test:api to true HTTP E2E, preserve mock tests as test:api:mock` | `package.json` |

---

### Step 2: L2 Auth Helper — E2E Session Acquisition

**Goal**: Obtain a real session cookie for authenticated API tests via Credentials provider.

**File**: `tests/api-e2e/helpers/auth.ts`

```typescript
/**
 * Acquire a session cookie from the Credentials provider (E2E_API=1 mode).
 * Same mechanism as Playwright auth setup, but headless via fetch().
 */

const BASE_URL = process.env.E2E_API_BASE_URL || "http://localhost:13042";

export async function getSessionCookie(): Promise<string> {
  // 1. Get CSRF token from signin page
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  const cookies = csrfRes.headers.getSetCookie();

  // 2. Sign in with Credentials provider
  const signinRes = await fetch(
    `${BASE_URL}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookies.join("; "),
      },
      body: new URLSearchParams({
        csrfToken,
        email: "e2e@test.local",
      }),
      redirect: "manual",
    }
  );

  // 3. Collect session cookie from redirect
  const allCookies = signinRes.headers.getSetCookie();
  const sessionCookie = allCookies
    .find((c) => c.startsWith("authjs.session-token=") || c.startsWith("__Secure-authjs.session-token="));

  if (!sessionCookie) {
    throw new Error("Failed to acquire session cookie for E2E");
  }

  return sessionCookie.split(";")[0];
}
```

#### Atomic commit

| # | Commit Message | Files |
|---|----------------|-------|
| 3 | `feat: add E2E auth helper for session cookie acquisition` | `tests/api-e2e/helpers/auth.ts` |

---

### Step 3: L2 Auth Mode — Credentials Provider for API E2E

**Goal**: Enable the Credentials provider when `E2E_API=1`, similar to existing `PLAYWRIGHT=1`.

**File**: `lib/auth.ts` — extend the existing Credentials provider guard:

```diff
- if (process.env.PLAYWRIGHT === "1" && process.env.NODE_ENV !== "production") {
+ const isE2E = (process.env.PLAYWRIGHT === "1" || process.env.E2E_API === "1")
+   && process.env.NODE_ENV !== "production";
+ if (isE2E) {
    providers.push(
      Credentials({ ... })
    );
  }
```

This reuses the existing security safeguards (non-production only, `ALLOWED_EMAILS` whitelist).

#### Atomic commit

| # | Commit Message | Files |
|---|----------------|-------|
| 4 | `feat: enable Credentials provider for E2E_API mode` | `lib/auth.ts` |

---

### Step 4: L2 True HTTP Test Suite

**Goal**: Write real HTTP E2E tests for all API routes and key Server Actions.

**Directory**: `tests/api-e2e/` (new, separate from `tests/api/` mock-based tests)

#### 4a. Health & Live endpoints

**File**: `tests/api-e2e/health.e2e.test.ts`

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| GET /api/health returns 200 + ok | GET | `/api/health` | None | `{ status: "ok", timestamp }` |
| GET /api/live returns 200 + version | GET | `/api/live` | None | `{ status: "ok", version, timestamp }` |

#### 4b. Secrets CRUD (via Server Actions, triggered by API or direct call through HTTP)

**File**: `tests/api-e2e/secrets.e2e.test.ts`

Since Server Actions are invoked via POST to the Next.js action endpoint, tests will:
1. Use session cookie from auth helper
2. Call Server Actions through the Next.js RSC action protocol, OR
3. Test via the Backup/Restore HTTP API which exercises the full CRUD chain

| Test Group | Count (est.) | Description |
|------------|-------------|-------------|
| Create + Read flow | ~6 | Create secret via action, verify via getSecrets |
| Update flow | ~4 | Update secret fields, verify persistence |
| Delete flow | ~2 | Delete secret, verify removal |
| Batch import | ~4 | Import multiple secrets, verify count |

#### 4c. Backup & Restore endpoints

**File**: `tests/api-e2e/backup.e2e.test.ts`

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| GET /api/backup/archive returns ZIP | GET | `/api/backup/archive` | Session cookie | Content-Type: application/zip, non-empty body |
| POST /api/backup/restore with valid ZIP | POST | `/api/backup/restore` | Session cookie | 200 + secrets restored |
| POST /api/backup/restore without auth → 401 | POST | `/api/backup/restore` | None | 401 |
| GET /api/backup/archive without auth → 401 | GET | `/api/backup/archive` | None | 401 |

#### 4d. Backy webhook endpoints

**File**: `tests/api-e2e/backy.e2e.test.ts`

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| HEAD /api/backy/pull with valid key → 200 | HEAD | `/api/backy/pull` | X-Webhook-Key | 200 |
| HEAD /api/backy/pull with invalid key → 401 | HEAD | `/api/backy/pull` | Bad key | 401 |
| POST /api/backy/pull with valid key → 200 | POST | `/api/backy/pull` | X-Webhook-Key | 200 + ZIP body |
| POST /api/backy/pull without key → 401 | POST | `/api/backy/pull` | None | 401 |

#### 4e. Settings actions (via HTTP)

**File**: `tests/api-e2e/settings.e2e.test.ts`

| Test Group | Count (est.) | Description |
|------------|-------------|-------------|
| Get/Update settings flow | ~4 | Read defaults → update → verify persistence |
| Encryption key flow | ~3 | Generate key → verify stored → verify secrets use it |

#### Atomic commits

| # | Commit Message | Files |
|---|----------------|-------|
| 5 | `test: add L2 health & live HTTP E2E tests` | `tests/api-e2e/health.e2e.test.ts` |
| 6 | `test: add L2 secrets CRUD HTTP E2E tests` | `tests/api-e2e/secrets.e2e.test.ts` |
| 7 | `test: add L2 backup & restore HTTP E2E tests` | `tests/api-e2e/backup.e2e.test.ts` |
| 8 | `test: add L2 backy webhook HTTP E2E tests` | `tests/api-e2e/backy.e2e.test.ts` |
| 9 | `test: add L2 settings HTTP E2E tests` | `tests/api-e2e/settings.e2e.test.ts` |

---

### Step 5: L2 Vitest Config for API E2E

**Goal**: Create a separate vitest config for true HTTP E2E tests (no jsdom, no mocks).

**File**: `vitest.config.api-e2e.ts`

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["tests/api-e2e/**/*.e2e.test.ts"],
    globals: true,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    // No jsdom — these are pure HTTP tests
    // No setupFiles — no mocks needed
    globalSetup: [],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
});
```

Update `scripts/run-e2e.ts` to use this config:

```diff
- await $`bun vitest run tests/api-e2e --reporter=verbose`
+ await $`bun vitest run --config vitest.config.api-e2e.ts --reporter=verbose`
```

#### Atomic commit

| # | Commit Message | Files |
|---|----------------|-------|
| 10 | `feat: add vitest config for true HTTP API E2E tests` | `vitest.config.api-e2e.ts`, `scripts/run-e2e.ts` |

---

### Step 6: L2 Wire Into pre-push Hook

**Goal**: Replace mock-based API tests with true HTTP E2E in pre-push.

**File**: `.husky/pre-push`

```bash
# L2: API E2E tests — true HTTP (pre-push, <3min)
bun run test:api

# G2: Security gate (osv-scanner + gitleaks)
bun run test:security
```

No file change needed — `test:api` already remapped in Step 1 to `bun scripts/run-e2e.ts`.

#### Atomic commit

| # | Commit Message | Files |
|---|----------------|-------|
| 11 | `chore: update pre-push hook comment to reflect true HTTP L2` | `.husky/pre-push` |

---

### Step 7: D1 Three-Layer Verification

**Goal**: Implement the three verification layers per spec.

#### 7a. Build-time binding verification

**File**: `worker/scripts/verify-test-bindings.ts`

```typescript
#!/usr/bin/env bun
/**
 * D1 Verification Layer 1: Build-time binding check.
 * Parses wrangler.toml [env.test] and asserts all D1 bindings use -test suffix.
 * Non-zero exit blocks the pipeline.
 */

import { readFileSync } from "fs";

const toml = readFileSync("wrangler.toml", "utf-8");

// Extract [env.test] d1 database names
const testSection = toml.split("[env.test]")[1];
if (!testSection) {
  console.error("❌ No [env.test] section in wrangler.toml");
  process.exit(1);
}

const dbNames = [...testSection.matchAll(/database_name\s*=\s*"([^"]+)"/g)]
  .map(m => m[1]);

if (dbNames.length === 0) {
  console.error("❌ No D1 databases found in [env.test]");
  process.exit(1);
}

const violations = dbNames.filter(name => !name.endsWith("-test"));
if (violations.length > 0) {
  console.error(`❌ D1 bindings without -test suffix: ${violations.join(", ")}`);
  process.exit(1);
}

console.log(`✅ All ${dbNames.length} D1 bindings verified: ${dbNames.join(", ")}`);
```

#### 7b. Runtime resource name check

**File**: `worker/test/helpers/verify-env.ts`

```typescript
/**
 * D1 Verification Layer 2: Runtime resource name check.
 * Called in test setup — throws if ENVIRONMENT !== "test".
 */
export function verifyTestEnvironment(env: { ENVIRONMENT?: string }): void {
  if (env.ENVIRONMENT !== "test") {
    throw new Error(
      `D1 isolation violation: ENVIRONMENT="${env.ENVIRONMENT}", expected "test". ` +
      `Refusing to run tests against non-test resources.`
    );
  }
}
```

#### 7c. Test data marker table

**SQL migration** (for `neo-db-test` only):

```sql
CREATE TABLE IF NOT EXISTS _test_marker (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO _test_marker (key, value) VALUES ('env', 'test');
```

**Verification in test setup**: Before any data reset, query `_test_marker` and assert `env=test`.

#### Atomic commits

| # | Commit Message | Files |
|---|----------------|-------|
| 12 | `feat: add D1 build-time binding verification script` | `worker/scripts/verify-test-bindings.ts` |
| 13 | `feat: add D1 runtime environment verification helper` | `worker/test/helpers/verify-env.ts` |
| 14 | `feat: add D1 test marker table migration for neo-db-test` | `worker/migrations/test/0001_test_marker.sql` |

---

### Step 8: Documentation & README Update

**Goal**: Update all documentation to reflect honest tier assessment and new architecture.

#### 8a. Update `docs/04-quality-system-upgrade.md`

Append an errata section:

```markdown
## Errata (2026-03-23)

The original execution log declared Tier S, but a thorough re-audit found L2 non-compliant:
`tests/api/` uses direct Server Action imports with `MockScopedDB`, not real HTTP.
See [docs/05-quality-system-v2-upgrade.md](./05-quality-system-v2-upgrade.md) for the corrective plan.
Actual tier at time of doc 04 completion: **B** (L1+G1 only).
```

#### 8b. Update `docs/README.md` index

Add entry for doc 05.

#### 8c. Update `README.md` quality system table

After implementation, update to reflect true current state.

#### Atomic commits

| # | Commit Message | Files |
|---|----------------|-------|
| 15 | `docs: add quality system v2 upgrade document` | `docs/05-quality-system-v2-upgrade.md`, `docs/README.md` |
| 16 | `docs: add errata to doc 04 re L2 non-compliance` | `docs/04-quality-system-upgrade.md` |
| 17 | `docs: update README quality system table post-upgrade` | `README.md` |

---

## Commit Summary

| # | Message | Dimension | Phase |
|---|---------|-----------|-------|
| 1 | `feat: add L2 run-e2e.ts script for auto dev server management` | L2 | Infrastructure |
| 2 | `refactor: remap test:api to true HTTP E2E, preserve mock tests as test:api:mock` | L2 | Infrastructure |
| 3 | `feat: add E2E auth helper for session cookie acquisition` | L2 | Infrastructure |
| 4 | `feat: enable Credentials provider for E2E_API mode` | L2 | Infrastructure |
| 5 | `test: add L2 health & live HTTP E2E tests` | L2 | Tests |
| 6 | `test: add L2 secrets CRUD HTTP E2E tests` | L2 | Tests |
| 7 | `test: add L2 backup & restore HTTP E2E tests` | L2 | Tests |
| 8 | `test: add L2 backy webhook HTTP E2E tests` | L2 | Tests |
| 9 | `test: add L2 settings HTTP E2E tests` | L2 | Tests |
| 10 | `feat: add vitest config for true HTTP API E2E tests` | L2 | Infrastructure |
| 11 | `chore: update pre-push hook comment to reflect true HTTP L2` | L2 | Hook |
| 12 | `feat: add D1 build-time binding verification script` | D1 | Verification |
| 13 | `feat: add D1 runtime environment verification helper` | D1 | Verification |
| 14 | `feat: add D1 test marker table migration for neo-db-test` | D1 | Verification |
| 15 | `docs: add quality system v2 upgrade document` | Docs | Documentation |
| 16 | `docs: add errata to doc 04 re L2 non-compliance` | Docs | Documentation |
| 17 | `docs: update README quality system table post-upgrade` | Docs | Documentation |

**Total: 17 atomic commits**

**Recommended execution order**: 15 → 1 → 2 → 3 → 4 → 10 → 5 → 6 → 7 → 8 → 9 → 11 → 12 → 13 → 14 → 16 → 17

(Document first, then L2 infrastructure, then L2 tests, then D1, then final docs update)

---

## Post-Upgrade Verification

```bash
# L1: Unit tests + coverage (should still pass unchanged)
bun run test:unit:coverage

# G1: Type check + lint (should still pass unchanged)
bun run typecheck && bun run lint

# L2: True HTTP API E2E (NEW — this is the key change)
bun run test:api

# G2: Security gate (should still pass unchanged)
bun run test:security

# L3: Playwright E2E (should still pass unchanged)
bun run test:e2e:pw

# D1: Verify test bindings (NEW)
cd worker && bun scripts/verify-test-bindings.ts
```

### Expected Tier After Upgrade

| Dimension | Status | Evidence |
|-----------|--------|----------|
| L1 | ✅ | 937+ unit tests, 95%+ coverage, 4-layer thresholds, pre-commit |
| L2 | ✅ | True HTTP E2E via `run-e2e.ts`, auto dev server, 100% route coverage, pre-push |
| L3 | ✅ | 35+ Playwright specs, real browser, manual/CI |
| G1 | ✅ | `tsc --noEmit` (strict) + ESLint `error` + `--max-warnings=0`, pre-commit |
| G2 | ✅ | `osv-scanner` + `gitleaks`, pre-push |
| D1 | ✅ | `neo-db-test` instance + 3-layer verification (build-time + runtime + marker table) |

**Target Tier: S** (all six dimensions genuinely green)

---

## Risk Considerations

| Risk | Mitigation |
|------|------------|
| True HTTP tests are slower (~10-20s for server startup) | `run-e2e.ts` polls `/api/health` with 500ms interval; pre-push budget is <3min |
| Server Action invocation via HTTP is undocumented Next.js internal | Test route handlers directly via standard HTTP; for actions, test through the UI-facing API routes that exercise them |
| D1 test database may not exist on developer machines | `verify-test-bindings.ts` only checks config, not actual DB existence; worker E2E tests are optional for main app developers |
| Existing mock-based tests become redundant | Kept as `test:api:mock` for fast local iteration; remove once true HTTP tests are stable |

## Out of Scope

| Item | Reason |
|------|--------|
| CI pipeline (GitHub Actions) | Separate initiative; local hooks provide enforcement |
| Worker true HTTP E2E | Worker is deployed to Cloudflare; local E2E would require `wrangler dev` setup, deferred |
| `tests/api/` removal | Preserved as `test:api:mock` for transition period; evaluate removal in next cycle |
