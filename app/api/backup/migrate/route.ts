/**
 * GET /api/backup/migrate
 *
 * Read-only migration route: reads old D1 backups and converts each
 * plain-text backup to an encrypted ZIP archive, bundled into a single
 * outer ZIP for download. Remains available until the backups table is
 * dropped (Phase 7.6).
 */

import { NextResponse } from "next/server";
import { getScopedDB } from "@/lib/auth-context";
import { createEncryptedZip } from "@/models/backup-archive";
import { zipSync } from "fflate";
import type { ParsedSecret, OtpType, OtpAlgorithm } from "@/models/types";

export async function GET() {
  try {
    const db = await getScopedDB();
    if (!db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const encryptionKey = await db.getEncryptionKey();
    if (!encryptionKey) {
      return NextResponse.json(
        { error: "Set up your encryption key in Settings before exporting backups." },
        { status: 400 },
      );
    }

    const backups = await db.getLegacyBackups();
    if (backups.length === 0) {
      return NextResponse.json(
        { error: "No existing backups to migrate." },
        { status: 404 },
      );
    }

    // Convert each plain-text backup to an encrypted ZIP
    const zipEntries: Record<string, Uint8Array> = {};

    for (const backup of backups) {
      // Skip encrypted backups from cron (v1: format) — we can't decrypt them here
      if (backup.encrypted) continue;

      try {
        const rawSecrets: unknown[] = JSON.parse(backup.data);
        const parsed: ParsedSecret[] = rawSecrets.map((s: unknown) => {
          const obj = s as Record<string, unknown>;
          return {
            name: String(obj.name ?? ""),
            account: String(obj.account ?? ""),
            secret: String(obj.secret ?? ""),
            type: (obj.type as OtpType) ?? "totp",
            digits: Number(obj.digits ?? 6),
            period: Number(obj.period ?? 30),
            algorithm: (obj.algorithm as OtpAlgorithm) ?? "SHA-1",
            counter: Number(obj.counter ?? 0),
          };
        });

        const zipBytes = await createEncryptedZip(parsed, encryptionKey);

        // Name each inner ZIP by original filename or creation date
        const name = backup.filename.replace(/\.json$/, ".zip");
        zipEntries[name] = Uint8Array.from(zipBytes);
      } catch {
        // Skip corrupted backups
        continue;
      }
    }

    if (Object.keys(zipEntries).length === 0) {
      return NextResponse.json(
        { error: "No plain-text backups available to migrate." },
        { status: 404 },
      );
    }

    // Bundle all encrypted ZIPs into one outer ZIP
    const outerZip = zipSync(zipEntries);

    const date = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const filename = `neo-migration-${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}.zip`;

    return new Response(outerZip.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(outerZip.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Failed to migrate backups:", error);
    return NextResponse.json(
      { error: "Failed to migrate backups" },
      { status: 500 },
    );
  }
}
