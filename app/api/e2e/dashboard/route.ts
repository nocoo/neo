/**
 * E2E-only API route for dashboard data.
 * Only active when E2E_SKIP_AUTH=true AND NODE_ENV !== "production".
 */

import { NextResponse } from "next/server";
import { isE2EMode } from "@/lib/auth-context";
import { getDashboardData } from "@/actions/dashboard";

function guardE2E(): NextResponse | null {
  if (!isE2EMode()) {
    return NextResponse.json({ error: "E2E routes disabled" }, { status: 404 });
  }
  return null;
}

/** GET /api/e2e/dashboard */
export async function GET(): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const result = await getDashboardData();
  return NextResponse.json(result);
}
