#!/usr/bin/env bun
/**
 * D1 Test Isolation Guards for neo.
 *
 * Three-layer defense ensuring E2E tests never touch production D1:
 * 1. Existence check: test env vars must be set
 * 2. DB non-equality check: test DB ID !== prod DB ID
 * 3. Marker check: test DB must contain _test_marker table with env='test'
 *
 * Neo uses the Cloudflare D1 HTTP API (via CLOUDFLARE_* env vars), so we
 * adapt the guard to match neo's env var naming convention.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TestGuardResult {
  /** Overridden env vars safe to use for E2E tests */
  env: Record<string, string>;
  testDbId: string;
  prodDbId: string;
}

// ---------------------------------------------------------------------------
// Core validation
// ---------------------------------------------------------------------------

/**
 * Validate test isolation and return overridden env vars.
 *
 * Expects:
 * - CLOUDFLARE_ACCOUNT_ID        (shared)
 * - CLOUDFLARE_API_TOKEN          (shared)
 * - CLOUDFLARE_D1_DATABASE_ID     (prod)
 * - CLOUDFLARE_D1_TEST_DATABASE_ID (test)
 *
 * Returns env where CLOUDFLARE_D1_DATABASE_ID points to the test DB.
 * Throws on any validation failure (hard gate).
 */
export async function validateAndOverride(
  env: Record<string, string | undefined>,
): Promise<TestGuardResult> {
  const errors: string[] = [];

  // --- Layer 1: Existence ---
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const prodDbId = env.CLOUDFLARE_D1_DATABASE_ID;
  const testDbId = env.CLOUDFLARE_D1_TEST_DATABASE_ID;

  if (!accountId) errors.push("CLOUDFLARE_ACCOUNT_ID not set");
  if (!apiToken) errors.push("CLOUDFLARE_API_TOKEN not set");
  if (!prodDbId) errors.push("CLOUDFLARE_D1_DATABASE_ID not set");
  if (!testDbId) errors.push("CLOUDFLARE_D1_TEST_DATABASE_ID not set");

  // --- Layer 2: DB non-equality ---
  if (testDbId && prodDbId && testDbId === prodDbId) {
    errors.push(
      `FATAL: test DB ID === prod DB ID (${testDbId}). ` +
        "Refusing to run E2E tests against production database.",
    );
  }

  // Bail early if layers 1-2 failed
  if (errors.length > 0) {
    throw new Error(
      `D1 Test Isolation FAILED:\n  ${errors.join("\n  ")}`,
    );
  }

  // After validation above, all four are guaranteed defined
  const safeAccountId = accountId as string;
  const safeApiToken = apiToken as string;
  const safeProdDbId = prodDbId as string;
  const safeTestDbId = testDbId as string;

  // --- Layer 3: Marker check ---
  await verifyTestMarker(safeAccountId, safeTestDbId, safeApiToken);

  // --- Build overridden env ---
  const overriddenEnv: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) overriddenEnv[k] = v;
  }
  overriddenEnv.CLOUDFLARE_D1_DATABASE_ID = safeTestDbId;

  return {
    env: overriddenEnv,
    testDbId: safeTestDbId,
    prodDbId: safeProdDbId,
  };
}

// ---------------------------------------------------------------------------
// Marker verification via D1 REST API
// ---------------------------------------------------------------------------

/**
 * Verify the test DB contains a _test_marker table with env='test'.
 * Uses the Cloudflare D1 REST API directly.
 */
export async function verifyTestMarker(
  accountId: string,
  databaseId: string,
  apiToken: string,
): Promise<void> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sql: "SELECT value FROM _test_marker WHERE key = 'env'",
      }),
    });
  } catch (err) {
    throw new Error(
      `D1 Test Isolation FAILED: cannot reach D1 API to verify _test_marker: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }

  if (!response.ok) {
    throw new Error(
      `D1 Test Isolation FAILED: D1 API returned HTTP ${response.status} ` +
        `when verifying _test_marker in database ${databaseId}`,
    );
  }

  const data = (await response.json()) as {
    success: boolean;
    result?: Array<{ results?: Array<{ value: string }> }>;
  };

  if (!data.success) {
    throw new Error(
      "D1 Test Isolation FAILED: D1 API query unsuccessful. " +
        "Is the _test_marker table created in the test DB?",
    );
  }

  const value = data.result?.[0]?.results?.[0]?.value;
  if (value !== "test") {
    throw new Error(
      `D1 Test Isolation FAILED: _test_marker.value = ${JSON.stringify(value)}, expected "test". ` +
        "This database may not be the test environment.",
    );
  }
}
