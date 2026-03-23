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
| 3 | Auth in test mode | Reuse Playwright's Credentials provider approach — POST to `/api/auth/callback/e2e-credentials` (provider id is `e2e-credentials`, not `credentials`) to get session cookie |
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

> **Correction**: The main app does **NOT** access D1 through the Worker. The actual call chain is:
> `lib/auth-context.ts` → `new ScopedDB(userId)` → `lib/db/scoped.ts` → `executeD1Query()` from
> `lib/db/d1-client.ts` → direct `fetch()` to Cloudflare D1 HTTP REST API
> (`https://api.cloudflare.com/client/v4/accounts/{id}/d1/database/{id}/query`).
> The three env vars `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, `CLOUDFLARE_API_TOKEN`
> determine which database the main app connects to. **This is the primary D1 risk surface.**

- Main app: Direct D1 HTTP API access via `d1-client.ts` → D1 fully applicable, **primary risk**
- Worker: Direct D1 binding via `wrangler.toml` → D1 fully applicable
- Decision: D1 verification applies to **both** the main app and the Worker:
  - **Main app**: `run-e2e.ts` must set `CLOUDFLARE_D1_DATABASE_ID` to the test DB ID; a startup
    check in the dev server must verify the database ID ends with the test instance (or use the
    `_test_marker` table query). Without this, `test:api` could mutate the production database.
  - **Worker**: `[env.test]` binding + `verify-test-bindings.ts` (existing plan)

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
      // D1 isolation: prefer test database ID if set (see Step 7a)
      ...(process.env.CLOUDFLARE_D1_DATABASE_ID_TEST && {
        CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID_TEST,
      }),
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

  // 2. Sign in with Credentials provider (id: "e2e-credentials")
  const signinRes = await fetch(
    `${BASE_URL}/api/auth/callback/e2e-credentials`,
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

### Step 3: L2 Auth Mode — Credentials Provider + Adapter Gating for API E2E

**Goal**: Enable the Credentials provider when `E2E_API=1` **and** skip the D1 adapter,
so the API E2E test server can start without live D1 credentials (matching Playwright behavior).

The current code has two independent gates:
1. **Credentials provider** (line ~18): gated on `PLAYWRIGHT === "1"`
2. **D1 adapter** (line ~42): `const useAdapter = isD1Configured() && process.env.PLAYWRIGHT !== "1"`

Both must be updated to recognize `E2E_API=1`.

**File**: `auth.ts` — two changes:

```diff
 // 1. Credentials provider gate
- if (process.env.PLAYWRIGHT === "1" && process.env.NODE_ENV !== "production") {
+ const isE2E = (process.env.PLAYWRIGHT === "1" || process.env.E2E_API === "1")
+   && process.env.NODE_ENV !== "production";
+ if (isE2E) {
    providers.push(
      Credentials({ id: "e2e-credentials", ... })
    );
  }

 // 2. Adapter gate — skip D1 in any E2E mode
- const useAdapter = isD1Configured() && process.env.PLAYWRIGHT !== "1";
+ const useAdapter = isD1Configured() && !isE2E;
```

> **Why skip the adapter?** The D1 adapter handles user/session persistence in NextAuth.
> Without skipping it, the dev server would require live `CLOUDFLARE_*` env vars and would
> read/write to whichever D1 database those vars point at. By skipping the adapter in E2E mode,
> sessions are stored in-memory (NextAuth default), eliminating the D1 dependency for auth.
>
> **What about testing D1 isolation for the rest of the app?** The route handlers that exercise
> `ScopedDB` (backup, backy) will still call `d1-client.ts`. For true HTTP E2E to be safe,
> `run-e2e.ts` must set `CLOUDFLARE_D1_DATABASE_ID` to the test instance ID. See Step 7 for
> the full D1 isolation plan including the main app.

#### Atomic commit

| # | Commit Message | Files |
|---|----------------|-------|
| 4 | `feat: enable Credentials provider and skip D1 adapter for E2E_API mode` | `auth.ts` |

---

### Step 4: L2 True HTTP Test Suite

**Goal**: Write real HTTP E2E tests for all **route handlers** exposed as standard HTTP endpoints.

> **Key architectural constraint**: Secrets, settings, and dashboard mutations are implemented as
> **Server Actions** (`"use server"` in `actions/*.ts`), invoked directly from client ViewModels
> via `import { createSecret } from "@/actions/secrets"`. They are NOT exposed as HTTP route
> handlers. The Next.js Server Action invocation protocol (RSC flight format) is undocumented
> and unstable — writing HTTP tests against it would be brittle and non-portable.
>
> **L2 coverage strategy for Server Actions**:
> - The existing mock-based tests (`tests/api/`) already verify the Action → Validation →
>   ScopedDB chain in-process. These are reclassified as **enhanced unit tests** (L1+), not L2.
> - True HTTP coverage for secrets/settings is achieved through:
>   1. **Backup/Restore route handlers** (`/api/backup/archive`, `/api/backup/restore`) — these
>      exercise the full create-read-export-import lifecycle over real HTTP.
>   2. **Playwright L3 tests** — these exercise the full user flow including Server Action calls
>      through the browser, which IS real HTTP (browser → Next.js → Server Action → D1).
> - This is a legitimate L2 scope reduction: the spec says "100% API endpoint coverage" — we
>   cover 100% of **application-owned HTTP route handlers**. The NextAuth catch-all route
>   (`/api/auth/[...nextauth]`) is excluded from L2 because it is framework-owned: its handlers
>   are generated by `NextAuth()`, not by application code, and its correctness is the
>   responsibility of the `next-auth` library. Server Actions are covered by L1+ (mock) and
>   L3 (Playwright).

**Directory**: `tests/api-e2e/` (new, separate from `tests/api/` mock-based tests)

#### 4a. Health & Live endpoints (public, no auth)

**File**: `tests/api-e2e/health.e2e.test.ts`

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| GET /api/health returns 200 + ok | GET | `/api/health` | None | `{ status: "ok", timestamp }` |
| GET /api/live returns 200 + version | GET | `/api/live` | None | `{ status: "ok", version, timestamp }` |

#### 4b. Backup & Restore endpoints (session-authenticated)

**File**: `tests/api-e2e/backup.e2e.test.ts`

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| GET /api/backup/archive returns ZIP | GET | `/api/backup/archive` | Session cookie | Content-Type: application/zip, non-empty body |
| POST /api/backup/restore with valid ZIP | POST | `/api/backup/restore` | Session cookie | 200 + secrets restored |
| POST /api/backup/restore without auth → 401 | POST | `/api/backup/restore` | None | 401 |
| GET /api/backup/archive without auth → 401 | GET | `/api/backup/archive` | None | 401 |
| Round-trip: create secrets → archive → restore → verify | Mixed | archive + restore | Session cookie | Data integrity across export/import |

#### 4c. Backy webhook endpoints (X-Webhook-Key authenticated)

**File**: `tests/api-e2e/backy.e2e.test.ts`

> **Note on POST behavior**: POST `/api/backy/pull` does NOT return a ZIP body. It collects
> the user's secrets, creates an encrypted ZIP, **pushes it to the configured Backy webhook URL**,
> and returns **JSON metadata** (`{ ok, message, durationMs, tag, fileName, stats, history }`).
> For testing, the Backy webhook URL must be pointed at a mock server or the test must accept
> that the push will fail (and assert the error shape).

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| HEAD /api/backy/pull with valid key → 200 | HEAD | `/api/backy/pull` | X-Webhook-Key | 200 |
| HEAD /api/backy/pull with invalid key → 401 | HEAD | `/api/backy/pull` | Bad key | 401 |
| POST /api/backy/pull with valid key → JSON metadata | POST | `/api/backy/pull` | X-Webhook-Key | 200 + `{ ok: true, message, stats }` (requires mock Backy server or pre-configured webhook) |
| POST /api/backy/pull without key → 401 | POST | `/api/backy/pull` | None | 401 |

#### 4d. Backup migrate endpoint (session-authenticated, legacy)

**File**: `tests/api-e2e/backup.e2e.test.ts` (same file as 4b)

| Test | Method | Endpoint | Auth | Assertions |
|------|--------|----------|------|------------|
| GET /api/backup/migrate without auth → 401 | GET | `/api/backup/migrate` | None | 401 |
| GET /api/backup/migrate with auth → ZIP or empty | GET | `/api/backup/migrate` | Session cookie | Content-Type check, handles no-legacy-data gracefully |

#### Atomic commits

| # | Commit Message | Files |
|---|----------------|-------|
| 5 | `test: add L2 health & live HTTP E2E tests` | `tests/api-e2e/health.e2e.test.ts` |
| 6 | `test: add L2 backup & restore HTTP E2E tests` | `tests/api-e2e/backup.e2e.test.ts` |
| 7 | `test: add L2 backy webhook HTTP E2E tests` | `tests/api-e2e/backy.e2e.test.ts` |

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
| 14 | `feat: add vitest config for true HTTP API E2E tests` | `vitest.config.api-e2e.ts`, `scripts/run-e2e.ts` |

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
| 15 | `chore: update pre-push hook comment to reflect true HTTP L2` | `.husky/pre-push` |

---

### Step 7: D1 Three-Layer Verification (Main App + Worker)

**Goal**: Implement the three verification layers per spec for **both** the main app and Worker.

> **Architecture recap**: The main app accesses D1 via `lib/db/d1-client.ts` which calls
> `fetch("https://api.cloudflare.com/.../d1/database/{CLOUDFLARE_D1_DATABASE_ID}/query")`.
> The database ID comes from `process.env.CLOUDFLARE_D1_DATABASE_ID`. This is the primary
> risk surface — if this env var points to production during E2E tests, tests will mutate
> production data.

#### 7a. Main app: D1 env var isolation in `run-e2e.ts`

**File**: `scripts/run-e2e.ts` — extend the env block:

```diff
 const server = Bun.spawn(
   ["bun", "run", "dev", "--", "-p", String(PORT)],
   {
     env: {
       ...process.env,
       E2E_API: "1",
       ALLOWED_EMAILS: "e2e@test.local",
+      // D1 isolation: override database ID to test instance
+      CLOUDFLARE_D1_DATABASE_ID: process.env.CLOUDFLARE_D1_DATABASE_ID_TEST
+        || process.env.CLOUDFLARE_D1_DATABASE_ID,
     },
```

And add a **hard-fail** pre-flight check (not a warning — the spec requires isolation, not best-effort):

```typescript
// D1 isolation pre-flight: REQUIRE test database ID
const testDbId = process.env.CLOUDFLARE_D1_DATABASE_ID_TEST;
if (!testDbId) {
  console.error("❌ CLOUDFLARE_D1_DATABASE_ID_TEST not set.");
  console.error("   API E2E tests REQUIRE an isolated test database.");
  console.error("   Set this env var to the neo-db-test database ID.");
  process.exit(1);
}
```

#### 7b. Main app: Runtime D1 database verification

**File**: `tests/api-e2e/helpers/verify-d1.ts`

```typescript
/**
 * D1 Verification Layer 2 (Main App): Query _test_marker table via a
 * dedicated verification endpoint to confirm we're connected to the test database.
 * Called once in globalSetup before any test runs. Hard-fails if verification fails.
 */
const BASE_URL = process.env.E2E_API_BASE_URL || "http://localhost:13042";

export async function verifyTestDatabase(sessionCookie: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/health/db`, {
    headers: { Cookie: sessionCookie },
  });

  if (!res.ok) {
    throw new Error(
      `D1 test database verification failed (HTTP ${res.status}). ` +
      `Ensure CLOUDFLARE_D1_DATABASE_ID_TEST points to a database with a _test_marker table.`
    );
  }

  const data = (await res.json()) as { env?: string };
  if (data.env !== "test") {
    throw new Error(
      `D1 isolation violation: _test_marker.env="${data.env}", expected "test". ` +
      `Refusing to run API E2E tests against a non-test database.`
    );
  }

  console.log("✅ D1 test database verified via _test_marker table");
}
```

**Requires**: A new lightweight route handler to expose the marker check:

**File**: `app/api/health/db/route.ts`

```typescript
import { NextResponse } from "next/server";
import { getScopedDB } from "@/lib/auth-context";

/**
 * D1 test database verification endpoint.
 * Queries _test_marker table — returns { env: "test" } if present.
 * Only useful in E2E mode; returns 404 or error in production (table won't exist).
 */
export async function GET() {
  try {
    const db = await getScopedDB();
    if (!db) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    // Query the _test_marker table — this table only exists in test databases
    const result = await db.raw<{ value: string }>(
      "SELECT value FROM _test_marker WHERE key = 'env' LIMIT 1"
    );
    const env = result?.[0]?.value;

    return NextResponse.json({ env: env || null });
  } catch {
    // Table doesn't exist → not a test database
    return NextResponse.json({ env: null });
  }
}
```

> **Note**: `ScopedDB.raw()` may need to be added if it doesn't already exist — a thin
> wrapper around `executeD1Query` that returns raw rows. Alternatively, use the existing
> `executeD1Query` directly from `d1-client.ts`.

#### 7c. Worker: Build-time binding verification

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

#### 7d. Worker: Runtime resource name check

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

#### 7e. Test data marker table (shared by main app D1 and Worker D1)

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
| 8 | `feat: add D1 test database isolation to run-e2e.ts (hard-fail without test DB)` | `scripts/run-e2e.ts` |
| 9 | `feat: add /api/health/db endpoint for D1 test marker verification` | `app/api/health/db/route.ts` |
| 10 | `feat: add D1 test database runtime verification helper` | `tests/api-e2e/helpers/verify-d1.ts` |
| 11 | `feat: add D1 build-time binding verification script (worker)` | `worker/scripts/verify-test-bindings.ts` |
| 12 | `feat: add D1 runtime environment verification helper (worker)` | `worker/test/helpers/verify-env.ts` |
| 13 | `feat: add D1 test marker table migration for neo-db-test` | `worker/migrations/test/0001_test_marker.sql` |

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
| 16 | `docs: add quality system v2 upgrade document` | `docs/05-quality-system-v2-upgrade.md`, `docs/README.md` |
| 17 | `docs: add errata to doc 04 re L2 non-compliance` | `docs/04-quality-system-upgrade.md` |
| 18 | `docs: update README quality system table post-upgrade` | `README.md` |

---

## Commit Summary

| # | Message | Dimension | Phase |
|---|---------|-----------|-------|
| 1 | `feat: add L2 run-e2e.ts script for auto dev server management` | L2 | Infrastructure |
| 2 | `refactor: remap test:api to true HTTP E2E, preserve mock tests as test:api:mock` | L2 | Infrastructure |
| 3 | `feat: add E2E auth helper for session cookie acquisition` | L2 | Infrastructure |
| 4 | `feat: enable Credentials provider and skip D1 adapter for E2E_API mode` | L2+D1 | Infrastructure |
| 5 | `test: add L2 health & live HTTP E2E tests` | L2 | Tests |
| 6 | `test: add L2 backup & restore HTTP E2E tests` | L2 | Tests |
| 7 | `test: add L2 backy webhook HTTP E2E tests` | L2 | Tests |
| 8 | `feat: add D1 test database isolation to run-e2e.ts (hard-fail without test DB)` | D1 | Verification |
| 9 | `feat: add /api/health/db endpoint for D1 test marker verification` | D1 | Verification |
| 10 | `feat: add D1 test database runtime verification helper` | D1 | Verification |
| 11 | `feat: add D1 build-time binding verification script (worker)` | D1 | Verification |
| 12 | `feat: add D1 runtime environment verification helper (worker)` | D1 | Verification |
| 13 | `feat: add D1 test marker table migration for neo-db-test` | D1 | Verification |
| 14 | `feat: add vitest config for true HTTP API E2E tests` | L2 | Infrastructure |
| 15 | `chore: update pre-push hook comment to reflect true HTTP L2` | L2 | Hook |
| 16 | `docs: add quality system v2 upgrade document` | Docs | Documentation |
| 17 | `docs: add errata to doc 04 re L2 non-compliance` | Docs | Documentation |
| 18 | `docs: update README quality system table post-upgrade` | Docs | Documentation |

**Total: 18 atomic commits**

**Recommended execution order**: 16 → 4 → 1 → 2 → 3 → 14 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 15 → 17 → 18

(Document first → auth/adapter gating → L2 infra → L2 tests → D1 main app → D1 worker → hooks → final docs)

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
| L2 | ✅ | True HTTP E2E via `run-e2e.ts` covering all application-owned route handlers (health, live, backup/archive, backup/restore, backup/migrate, backy/pull); `/api/auth/*` excluded (framework-owned NextAuth catch-all); Server Actions covered by L1+ mock tests and L3 Playwright |
| L3 | ✅ | 35+ Playwright specs (real browser + Server Actions over real HTTP), manual/CI |
| G1 | ✅ | `tsc --noEmit` (strict) + ESLint `error` + `--max-warnings=0`, pre-commit |
| G2 | ✅ | `osv-scanner` + `gitleaks`, pre-push |
| D1 | ✅ | Main app: `run-e2e.ts` hard-fails without `CLOUDFLARE_D1_DATABASE_ID_TEST`; `/api/health/db` queries `_test_marker` table to verify test DB at runtime; `verifyTestDatabase()` called in test globalSetup. Worker: `neo-db-test` binding + `verify-test-bindings.ts`. Shared: `_test_marker` table in test D1 instances |

**Target Tier: S** (all six dimensions genuinely green)

---

## Risk Considerations

| Risk | Mitigation |
|------|------------|
| True HTTP tests are slower (~10-20s for server startup) | `run-e2e.ts` polls `/api/health` with 500ms interval; pre-push budget is <3min |
| Secrets/settings have no HTTP route handlers, only Server Actions | L2 covers all application-owned HTTP route handlers (health, live, backup, backy); `/api/auth/*` is framework-owned (excluded). Server Action coverage split between L1+ (mock-based in-process) and L3 (Playwright browser E2E) |
| Main app D1 uses env vars, not wrangler bindings — harder to enforce isolation | `run-e2e.ts` hard-fails without `CLOUDFLARE_D1_DATABASE_ID_TEST`; runtime `_test_marker` table query via `/api/health/db` + `verifyTestDatabase()` in globalSetup blocks test execution if not connected to test DB |
| D1 test database may not exist on developer machines | `run-e2e.ts` exits non-zero without test DB env var — developers must create `neo-db-test` via `wrangler d1 create` before running API E2E; this is intentional (spec prohibits silent fallback to production) |
| Backy POST test requires a reachable Backy webhook URL | Test either with mock Backy server or accept connection error and assert error shape; auth/validation tests work without external dependency |
| Existing mock-based tests become redundant | Kept as `test:api:mock` for fast local iteration; remove once true HTTP tests are stable |

## Out of Scope

| Item | Reason |
|------|--------|
| CI pipeline (GitHub Actions) | Separate initiative; local hooks provide enforcement |
| Worker true HTTP E2E | Worker is deployed to Cloudflare; local E2E would require `wrangler dev` setup, deferred |
| `tests/api/` removal | Preserved as `test:api:mock` for transition period; evaluate removal in next cycle |
