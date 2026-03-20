/**
 * GET /api/backup/archive
 *
 * Creates an encrypted ZIP archive of the user's secrets and returns it
 * as a binary download. Route Handler (not Server Action) because binary
 * Response cannot cross the RSC serialization boundary.
 */

import { NextResponse } from "next/server";
import { getScopedDB } from "@/lib/auth-context";
import { createEncryptedZip, generateArchiveFilename } from "@/models/backup-archive";
import type { ParsedSecret } from "@/models/types";

export async function GET() {
  try {
    const db = await getScopedDB();
    if (!db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const encryptionKey = await db.getEncryptionKey();
    if (!encryptionKey) {
      return NextResponse.json(
        { error: "No encryption key configured. Set up your encryption key in Settings first." },
        { status: 400 },
      );
    }

    const secrets = await db.getSecrets();

    // Map Secret → ParsedSecret (strip DB-only fields)
    const parsed: ParsedSecret[] = secrets.map((s) => ({
      name: s.name,
      account: s.account ?? "",
      secret: s.secret,
      type: s.type,
      digits: s.digits,
      period: s.period,
      algorithm: s.algorithm,
      counter: s.counter,
    }));

    const zipBytes = await createEncryptedZip(parsed, encryptionKey);
    const filename = generateArchiveFilename();

    return new Response(zipBytes.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(zipBytes.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to create backup archive:", error);
    return NextResponse.json(
      { error: "Failed to create backup archive" },
      { status: 500 },
    );
  }
}
