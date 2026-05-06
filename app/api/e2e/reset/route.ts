/**
 * E2E-only API route: reset in-memory storage.
 * Only active when E2E_SKIP_AUTH=true AND NODE_ENV !== "production".
 * Allows tests to fully reset state between runs without individual deletes.
 */

import { NextResponse } from "next/server";
import { isE2EMode } from "@/lib/auth-context";
import { resetE2EStorage } from "@/lib/e2e/scoped-db";

/** POST /api/e2e/reset — clear all in-memory E2E data */
export async function POST(): Promise<NextResponse> {
  if (!isE2EMode()) {
    return NextResponse.json({ error: "E2E routes disabled" }, { status: 404 });
  }

  resetE2EStorage();
  return NextResponse.json({ success: true });
}
