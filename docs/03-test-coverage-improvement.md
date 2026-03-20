# 03 — Test Coverage Improvement Plan

Elevate Neo's test infrastructure to fully align with the **Four-Layer Testing Architecture** standard.

## Current State

| Metric | Current | Target |
|--------|---------|--------|
| Total tests | 934 (869 main + 65 worker) | — |
| Statement coverage | 83.99% | ≥ 90% |
| Branch coverage | 78.00% | ≥ 80% |
| Threshold enforcement | `models/**` only | All production layers |
| Playwright E2E | 38 specs | Cover all CRUD flows |
| Worker coverage | Not tracked | Tracked + thresholds |

### Layer-by-Layer Assessment

| Layer | Status | Gap |
|-------|--------|-----|
| **L1 — UT** | ✅ 934 tests, pre-commit hook | Coverage < 90% globally; threshold only on models |
| **L2 — Lint** | ⚠️ `eslint --max-warnings=0` in lint-staged | `@typescript-eslint/no-unused-vars` is `warn` not `error`; no strict TS plugin |
| **L3 — API E2E** | ⚠️ 2 files covering ~45 tests | Missing Backy actions, legacy backup actions |
| **L4 — BDD E2E** | ✅ 38 Playwright specs | Covers auth, secrets, dashboard pages |

### Coverage Gaps (files at 0% or near-zero)

| File | Lines | Why it matters |
|------|-------|----------------|
| `lib/db/scoped.ts` | 326 | Core data-access layer; every action depends on it |
| `lib/db/d1-client.ts` | 102 | HTTP transport to Cloudflare D1 |
| `lib/auth-adapter.ts` | 238 | Auth.js adapter — user/session lifecycle |
| `lib/auth-context.ts` | 43 | Server-side auth helpers (getSession, getScopedDB) |
| `middleware.ts` | 39 | Route protection for `/dashboard/**` |
| `app/**/page.tsx` (6 files) | ~320 total | Page-level rendering, mostly thin wrappers |

---

## Plan

### Phase 1 — Expand coverage thresholds and tracking

**Goal**: Make the coverage config accurately reflect what we want to protect.

**Changes to `vitest.config.ts`**:

1. Add thresholds for all production layers:

```ts
thresholds: {
  "models/**": {
    lines: 90, functions: 90, branches: 80, statements: 90,
  },
  "viewmodels/**": {
    lines: 90, functions: 90, branches: 80, statements: 90,
  },
  "actions/**": {
    lines: 85, functions: 85, branches: 75, statements: 85,
  },
  "lib/**": {
    lines: 80, functions: 80, branches: 70, statements: 80,
  },
},
```

2. Expand `coverage.include` to capture all tested components:

```ts
include: [
  "lib/**/*.ts",
  "models/**/*.ts",
  "actions/**/*.ts",
  "middleware.ts",
  "viewmodels/**/*.ts",
  "hooks/**/*.tsx",
  "components/dashboard/**/*.tsx",   // already included
  "components/app-sidebar.tsx",      // already included
  "components/dashboard-shell.tsx",  // already included
  "components/theme-toggle.tsx",     // already included
],
```

> Note: `app/**/page.tsx` are thin server components — keep them in include but do not enforce thresholds. `lib/db/schema.ts` and `models/types.ts` remain excluded (pure types).

3. Move `lib/auth-adapter.ts` to coverage **exclude** — it's a thin Auth.js adapter whose 12 methods are prescribed by the interface; testing them requires a live D1 or heavy integration mock with diminishing returns.

**Commit**: `refactor: expand coverage thresholds to all production layers`

---

### Phase 2 — L1: Unit tests for `lib/db/scoped.ts` (0% → 90%+)

**Goal**: Test the core data-access layer that every server action depends on.

**Strategy**: `ScopedDB` takes a D1 database interface in its constructor. We can inject a mock that records SQL calls and returns canned results — similar to how `tests/api/setup.ts` already implements `MockScopedDB`, but here we test `ScopedDB` itself.

**File**: `tests/unit/lib/scoped.test.ts`

**Test groups**:

| Group | Methods | Test count (est.) |
|-------|---------|-------------------|
| Secrets CRUD | `getSecrets`, `getSecretById`, `createSecret`, `updateSecret`, `deleteSecret`, `getSecretCount` | ~18 |
| User Settings | `getUserSettings`, `upsertUserSettings` | ~6 |
| Encryption | `getEncryptionKey`, `setEncryptionKey` | ~4 |
| Backy Settings | `getBackySettings`, `upsertBackySettings` | ~6 |
| Backy Pull Webhook | `getBackyPullWebhook`, `upsertBackyPullWebhook`, `deleteBackyPullWebhook` | ~6 |
| Legacy Backup | `getLegacyBackupCount`, `getLegacyBackups` | ~4 |
| Standalone | `verifyBackyPullWebhook` | ~2 |
| Edge cases | User-scoping isolation, empty results, SQL error propagation | ~6 |

**Mock approach**: Create a `MockD1Database` that implements the D1 `prepare → bind → first/all/run` chain and captures the SQL + params for assertion.

**Commit**: `test: add unit tests for ScopedDB (lib/db/scoped.ts)`

---

### Phase 3 — L1: Unit tests for `lib/db/d1-client.ts` (8% → 90%+)

**Goal**: Test the HTTP transport layer independently of Cloudflare.

**File**: `tests/unit/lib/d1-client.test.ts`

**Test groups**:

| Group | Function | Test count (est.) |
|-------|----------|-------------------|
| Credentials | `getD1Credentials` — returns env vars, throws on missing | ~3 |
| Headers | `getD1Headers` — constructs Bearer header | ~2 |
| Execute query | `executeD1Query` — success, D1 error, network error, timeout, unique constraint | ~8 |
| Config check | `isD1Configured` — all present, partial, none | ~3 |

**Mock approach**: Mock `global.fetch` to simulate D1 API responses.

**Commit**: `test: add unit tests for D1 HTTP client`

---

### Phase 4 — L1: Unit tests for `lib/auth-context.ts` (0% → 90%+) and `middleware.ts` (0% → 90%+)

**Goal**: Cover the auth utility layer and route protection logic.

#### 4a. `lib/auth-context.ts` (43 lines)

**File**: `tests/unit/lib/auth-context.test.ts`

| Test | Description |
|------|-------------|
| `getSession` returns cached session | Mock `auth()`, call twice, assert single invocation |
| `getScopedDB` returns ScopedDB for authed user | Mock session with userId |
| `getScopedDB` returns null for unauthenticated | Mock null session |
| `getAuthContext` returns { db, userId } | Happy path |
| `requireAuth` returns userId | Happy path + null case |

**Commit**: `test: add unit tests for auth-context`

#### 4b. `middleware.ts` (39 lines)

**File**: `tests/unit/middleware.test.ts`

| Test | Description |
|------|-------------|
| `/` — passes through | No redirect |
| `/dashboard` — authed — passes through | Session present |
| `/dashboard` — unauthed — redirects to `/?callbackUrl=` | 302 redirect |
| `/dashboard/settings` — unauthed — redirects | Nested route |
| Static assets — skipped by matcher | `_next/static`, images, etc. |

**Mock approach**: Mock `next-auth` `auth` and test the middleware function directly with `NextRequest`.

**Commit**: `test: add unit tests for middleware route protection`

---

### Phase 5 — L2: Lint strictness upgrade

**Goal**: Achieve zero-tolerance lint with strict TypeScript checking.

**Changes to `eslint.config.mjs`**:

1. Promote `@typescript-eslint/no-unused-vars` from `warn` → `error`:

```js
rules: {
  "@typescript-eslint/no-unused-vars": [
    "error",  // was "warn"
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
},
```

2. Verify `--max-warnings=0` is already in both `lint` script and `lint-staged` config (✅ confirmed).

**Commit**: `refactor: promote unused-vars lint rule to error`

---

### Phase 6 — L3: API E2E coverage for Backy actions

**Goal**: Cover the remaining server actions not yet tested in `tests/api/`.

**File**: `tests/api/backy.e2e.test.ts`

**Actions to cover**:

| Action | Source file | Test count (est.) |
|--------|-------------|-------------------|
| `getBackySettings` | `actions/backy.ts` | ~3 |
| `upsertBackySettings` | `actions/backy.ts` | ~4 |
| `getBackyPullWebhook` | `actions/backy.ts` | ~3 |
| `upsertBackyPullWebhook` | `actions/backy.ts` | ~4 |
| `deleteBackyPullWebhook` | `actions/backy.ts` | ~2 |

**Prerequisite**: `MockScopedDB` in `tests/api/setup.ts` needs to implement the Backy methods (currently may be stubs). Extend it.

**Commit**: `test: add API E2E tests for Backy actions`

---

### Phase 7 — Worker coverage configuration

**Goal**: Track and enforce coverage for the worker package.

**Changes to `worker/vitest.config.ts`**:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json"],
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 75,
        statements: 85,
      },
    },
  },
});
```

**Add script to `worker/package.json`**:

```json
"test:coverage": "vitest run --coverage"
```

**Commit**: `test: add coverage tracking to worker package`

---

## Commit Sequence

| # | Commit message | Phase | Impact |
|---|----------------|-------|--------|
| 1 | `refactor: expand coverage thresholds to all production layers` | 1 | Config only; may fail CI if current coverage is below new thresholds — run after Phase 2-4 |
| 2 | `test: add unit tests for ScopedDB` | 2 | Biggest coverage jump (~326 lines from 0% → 90%) |
| 3 | `test: add unit tests for D1 HTTP client` | 3 | ~102 lines from 8% → 90% |
| 4 | `test: add unit tests for auth-context` | 4a | ~43 lines from 0% → 90% |
| 5 | `test: add unit tests for middleware route protection` | 4b | ~39 lines from 0% → 90% |
| 6 | `refactor: promote unused-vars lint rule to error` | 5 | Lint strictness |
| 7 | `test: add API E2E tests for Backy actions` | 6 | L3 completeness |
| 8 | `test: add coverage tracking to worker package` | 7 | Worker visibility |

**Recommended execution order**: 2 → 3 → 4 → 5 → 1 (activate thresholds after tests are in place) → 6 → 7 → 8

---

## Expected Outcome

| Metric | Before | After |
|--------|--------|-------|
| Statement coverage | 83.99% | ~92%+ |
| `lib/db/` coverage | 4.04% | ~90% |
| `middleware.ts` coverage | 0% | ~90% |
| `lib/auth-context.ts` coverage | 0% | ~90% |
| Enforced threshold layers | 1 (`models/**`) | 4 (`models`, `viewmodels`, `actions`, `lib`) |
| Lint strictness | `warn` on unused vars | `error` on unused vars |
| Worker coverage | Not tracked | Tracked with 85% threshold |
| API E2E actions covered | 11 | 16+ |

---

## Out of Scope

| Item | Reason |
|------|--------|
| `lib/auth-adapter.ts` tests | Auth.js adapter with 12 prescribed interface methods; requires live D1 or heavy integration mock; ROI too low |
| `app/**/page.tsx` tests | Thin server components (15 lines each) that delegate to views; covered by Playwright E2E |
| CI pipeline setup | Separate initiative; current husky hooks provide local enforcement |
| Additional Playwright specs | Current 38 specs cover auth + all pages; expand only when new user flows are added |
