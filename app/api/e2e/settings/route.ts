/**
 * E2E-only API routes for settings + encryption key.
 * Only active when E2E_SKIP_AUTH=true AND NODE_ENV !== "production".
 */

import { NextRequest, NextResponse } from "next/server";
import { isE2EMode } from "@/lib/auth-context";
import {
  getUserSettings,
  updateUserSettings,
  generateAndSaveEncryptionKey,
} from "@/actions/settings";

function guardE2E(): NextResponse | null {
  if (!isE2EMode()) {
    return NextResponse.json({ error: "E2E routes disabled" }, { status: 404 });
  }
  return null;
}

/** GET /api/e2e/settings */
export async function GET(): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const result = await getUserSettings();
  return NextResponse.json(result);
}

/** PUT /api/e2e/settings — update settings */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const body = await req.json();
  const result = await updateUserSettings(body);
  return NextResponse.json(result);
}

/** POST /api/e2e/settings — generate encryption key */
export async function POST(): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const result = await generateAndSaveEncryptionKey();
  return NextResponse.json(result);
}
