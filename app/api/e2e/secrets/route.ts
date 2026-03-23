/**
 * E2E-only API routes for secrets.
 * Only active when E2E_SKIP_AUTH=true.
 * Thin wrappers around Server Actions for real HTTP testing.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSecrets,
  getSecretById,
  createSecret,
  updateSecret,
  deleteSecret,
  getSecretCount,
  batchImportSecrets,
} from "@/actions/secrets";

function guardE2E(): NextResponse | null {
  if (process.env.E2E_SKIP_AUTH !== "true") {
    return NextResponse.json({ error: "E2E routes disabled" }, { status: 404 });
  }
  return null;
}

/** GET /api/e2e/secrets — list or get by id (?id=xxx) or count (?count=true) */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const id = req.nextUrl.searchParams.get("id");
  const count = req.nextUrl.searchParams.get("count");

  if (count === "true") {
    const result = await getSecretCount();
    return NextResponse.json(result);
  }

  if (id) {
    const result = await getSecretById(id);
    return NextResponse.json(result);
  }

  const result = await getSecrets();
  return NextResponse.json(result);
}

/** POST /api/e2e/secrets — create or batch import */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const body = await req.json();

  // Batch import when body is an array
  if (Array.isArray(body)) {
    const result = await batchImportSecrets(body);
    return NextResponse.json(result);
  }

  const result = await createSecret(body);
  return NextResponse.json(result);
}

/** PUT /api/e2e/secrets — update */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const body = await req.json();
  const result = await updateSecret(body);
  return NextResponse.json(result);
}

/** DELETE /api/e2e/secrets?id=xxx — delete */
export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const blocked = guardE2E();
  if (blocked) return blocked;

  const id = req.nextUrl.searchParams.get("id") ?? "";
  const result = await deleteSecret(id);
  return NextResponse.json(result);
}
