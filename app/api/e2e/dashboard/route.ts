/**
 * E2E-only API route for dashboard data.
 * Only active when E2E_SKIP_AUTH=true.
 */

import { NextResponse } from "next/server";
import { getDashboardData } from "@/actions/dashboard";

/** GET /api/e2e/dashboard */
export async function GET(): Promise<NextResponse> {
  if (process.env.E2E_SKIP_AUTH !== "true") {
    return NextResponse.json({ error: "E2E routes disabled" }, { status: 404 });
  }

  const result = await getDashboardData();
  return NextResponse.json(result);
}
