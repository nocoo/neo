/**
 * GET /api/backup/migrate
 *
 * Read-only migration route: reads old D1 backups and converts each
 * recoverable backup to an encrypted ZIP archive, bundled into a single
 * outer ZIP for download. Remains available until the backups table is
 * dropped (Phase 7.6).
 *
 * Handles two known plain-text formats:
 *   1. Manual backups: raw JSON array of secrets `[{name, secret, ...}, ...]`
 *   2. Cron unencrypted: versioned object `{version, timestamp, count, secrets: [...]}`
 *
 * Encrypted cron backups (v1: format) are skipped — they were encrypted
 * with a server-wide Worker env var key that is not available here.
 */

import { NextResponse } from "next/server";
import { getScopedDB } from "@/lib/auth-context";
import { createEncryptedZip } from "@/models/backup-archive";
import { isEncrypted } from "@/models/encryption";
import { zipSync } from "fflate";
import type { ParsedSecret } from "@/models/types";
import type { OtpType, OtpAlgorithm } from "@/models/constants";

/**
 * Try to extract a secrets array from a backup's JSON data.
 * Returns null if the data can't be parsed into secrets.
 */
function extractSecrets(data: string): ParsedSecret[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }

  // Format 1: raw JSON array (manual backups)
  // e.g. [{name: "GitHub", secret: "...", ...}, ...]
  if (Array.isArray(parsed)) {
    return parsed.map(toSecret);
  }

  // Format 2: versioned object (cron unencrypted backups)
  // e.g. {version: "1.0", timestamp: "...", count: N, secrets: [...]}
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "secrets" in (parsed as Record<string, unknown>) &&
    Array.isArray((parsed as Record<string, unknown>).secrets)
  ) {
    return ((parsed as Record<string, unknown>).secrets as unknown[]).map(
      toSecret,
    );
  }

  return null;
}

function toSecret(s: unknown): ParsedSecret {
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
}

export async function GET() {
  try {
    const db = await getScopedDB();
    if (!db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const encryptionKey = await db.getEncryptionKey();
    if (!encryptionKey) {
      return NextResponse.json(
        {
          error:
            "Set up your encryption key in Settings before exporting backups.",
        },
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

    // Convert each recoverable backup to an encrypted ZIP
    const zipEntries: Record<string, Uint8Array> = {};
    let skippedEncrypted = 0;
    let skippedUnparseable = 0;

    for (const backup of backups) {
      // Skip encrypted cron backups — the server-wide key is unavailable
      if (backup.encrypted || isEncrypted(backup.data)) {
        skippedEncrypted++;
        continue;
      }

      const secrets = extractSecrets(backup.data);
      if (!secrets) {
        skippedUnparseable++;
        continue;
      }

      try {
        const zipBytes = await createEncryptedZip(secrets, encryptionKey);

        // Name each inner ZIP by original filename or creation date
        const name = backup.filename.replace(/\.json$/, ".zip");
        zipEntries[name] = Uint8Array.from(zipBytes);
      } catch {
        skippedUnparseable++;
        continue;
      }
    }

    if (Object.keys(zipEntries).length === 0) {
      const parts: string[] = [];
      if (skippedEncrypted > 0) {
        parts.push(
          `${skippedEncrypted} encrypted with an unavailable server key`,
        );
      }
      if (skippedUnparseable > 0) {
        parts.push(`${skippedUnparseable} with unrecognized format`);
      }
      const detail =
        parts.length > 0 ? ` (${parts.join(", ")})` : "";
      return NextResponse.json(
        {
          error: `No plain-text backups available to migrate${detail}.`,
        },
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
