/**
 * POST /api/backup/restore
 *
 * Restores secrets from an encrypted ZIP archive.
 * Accepts multipart/form-data with:
 *   - file: the ZIP archive
 *   - encryptionKey: the base64 encryption key
 *
 * Route Handler (not Server Action) because it accepts binary file upload.
 */

import { NextResponse } from "next/server";
import { getScopedDB } from "@/lib/auth-context";
import { openEncryptedZip } from "@/models/backup-archive";
import { validateBase32 } from "@/models/validation";
import { OTP_DEFAULTS } from "@/models/constants";

export async function POST(request: Request) {
  try {
    const db = await getScopedDB();
    if (!db) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const encryptionKey = formData.get("encryptionKey");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "Missing or invalid file" },
        { status: 400 },
      );
    }

    if (!encryptionKey || typeof encryptionKey !== "string") {
      return NextResponse.json(
        { error: "Missing encryption key" },
        { status: 400 },
      );
    }

    // Read file into Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const zipBytes = new Uint8Array(arrayBuffer);

    // Decrypt and extract secrets
    let parsedSecrets;
    try {
      parsedSecrets = await openEncryptedZip(zipBytes, encryptionKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Decryption failed";
      return NextResponse.json(
        { error: `Failed to decrypt archive: ${message}` },
        { status: 400 },
      );
    }

    // Import secrets using same dedup logic as batchImportSecrets
    const existing = await db.getSecrets();
    const existingKeys = new Set(
      existing.map((s) => `${s.name.toLowerCase()}::${s.secret.toLowerCase()}`),
    );

    const batchKeys = new Set<string>();
    let imported = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const secret of parsedSecrets) {
      try {
        if (!secret.name || !secret.secret || !validateBase32(secret.secret).valid) {
          skipped++;
          continue;
        }

        const normalizedSecret = secret.secret.toUpperCase().replace(/\s/g, "");
        const dedupKey = `${secret.name.trim().toLowerCase()}::${normalizedSecret.toLowerCase()}`;

        if (existingKeys.has(dedupKey) || batchKeys.has(dedupKey)) {
          duplicates++;
          continue;
        }
        batchKeys.add(dedupKey);

        const id = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

        await db.createSecret({
          id,
          name: secret.name.trim(),
          account: secret.account?.trim() || null,
          secret: normalizedSecret,
          type: secret.type ?? OTP_DEFAULTS.type,
          digits: secret.digits ?? OTP_DEFAULTS.digits,
          period: secret.period ?? OTP_DEFAULTS.period,
          algorithm: secret.algorithm ?? OTP_DEFAULTS.algorithm,
          counter: secret.counter ?? OTP_DEFAULTS.counter,
        });
        imported++;
      } catch {
        skipped++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      duplicates,
    });
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return NextResponse.json(
      { error: "Failed to restore backup" },
      { status: 500 },
    );
  }
}
