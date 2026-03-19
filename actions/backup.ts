"use server";

/**
 * Backup Server Actions.
 *
 * All actions return ActionResult<T> — never throw.
 */

import { getScopedDB } from "@/lib/auth-context";
import { generateBackupFilename } from "@/models/backup";
import { BACKUP_MAX_COUNT } from "@/models/constants";
import { batchImportSecrets } from "@/actions/secrets";
import type { ActionResult, Backup, CreateSecretInput } from "@/models/types";

/**
 * Simple FNV-1a hash for backup change detection.
 */
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * List all backups for the authenticated user.
 */
export async function getBackups(): Promise<ActionResult<Backup[]>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const backups = await db.getBackups();
    return { success: true, data: backups };
  } catch (error) {
    console.error("Failed to get backups:", error);
    return { success: false, error: "Failed to load backups" };
  }
}

/**
 * Get the latest backup.
 */
export async function getLatestBackup(): Promise<ActionResult<Backup | null>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const backup = await db.getLatestBackup();
    return { success: true, data: backup };
  } catch (error) {
    console.error("Failed to get latest backup:", error);
    return { success: false, error: "Failed to load latest backup" };
  }
}

/**
 * Get backup count.
 */
export async function getBackupCount(): Promise<ActionResult<number>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const count = await db.getBackupCount();
    return { success: true, data: count };
  } catch (error) {
    console.error("Failed to get backup count:", error);
    return { success: false, error: "Failed to get backup count" };
  }
}

/**
 * Create a manual backup.
 */
export async function createManualBackup(
  secretsJson: string
): Promise<ActionResult<Backup>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    if (!secretsJson) {
      return { success: false, error: "Backup data is required" };
    }

    // Parse to validate and count
    let parsed: unknown[];
    try {
      parsed = JSON.parse(secretsJson);
      if (!Array.isArray(parsed)) {
        return { success: false, error: "Invalid backup data format" };
      }
    } catch {
      return { success: false, error: "Invalid JSON data" };
    }

    const hash = hashString(secretsJson);
    const id = `bk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
    const filename = generateBackupFilename();

    const backup = await db.createBackup({
      id,
      filename,
      data: secretsJson,
      secretCount: parsed.length,
      encrypted: false,
      reason: "manual",
      hash,
    });

    // Cleanup old backups
    await db.deleteOldBackups(BACKUP_MAX_COUNT);

    return { success: true, data: backup };
  } catch (error) {
    console.error("Failed to create backup:", error);
    return { success: false, error: "Failed to create backup" };
  }
}

/**
 * Delete old backups beyond retention limit.
 */
export async function cleanupBackups(): Promise<ActionResult<{ deleted: number }>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    const deleted = await db.deleteOldBackups(BACKUP_MAX_COUNT);
    return { success: true, data: { deleted } };
  } catch (error) {
    console.error("Failed to cleanup backups:", error);
    return { success: false, error: "Failed to cleanup backups" };
  }
}

/**
 * Restore secrets from a backup.
 *
 * Parses the backup JSON data and imports via batchImportSecrets,
 * which handles duplicate detection automatically.
 */
export async function restoreBackup(
  backupData: string
): Promise<ActionResult<{ imported: number; skipped: number; duplicates: number }>> {
  try {
    const db = await getScopedDB();
    if (!db) return { success: false, error: "Unauthorized" };

    if (!backupData) {
      return { success: false, error: "Backup data is required" };
    }

    // Parse the backup JSON
    let parsed: unknown[];
    try {
      parsed = JSON.parse(backupData);
      if (!Array.isArray(parsed)) {
        return { success: false, error: "Invalid backup data format" };
      }
    } catch {
      return { success: false, error: "Invalid JSON data" };
    }

    if (parsed.length === 0) {
      return { success: false, error: "Backup contains no secrets" };
    }

    // Convert backup entries to CreateSecretInput
    const inputs: CreateSecretInput[] = parsed.map((entry) => {
      const e = entry as Record<string, unknown>;
      return {
        name: (e.name as string) || "",
        account: (e.account as string) || undefined,
        secret: (e.secret as string) || "",
        type: e.type as CreateSecretInput["type"],
        digits: e.digits as number | undefined,
        period: e.period as number | undefined,
        algorithm: e.algorithm as CreateSecretInput["algorithm"],
        counter: e.counter as number | undefined,
      };
    });

    // Delegate to batchImportSecrets (handles dedup + validation)
    return await batchImportSecrets(inputs);
  } catch (error) {
    console.error("Failed to restore backup:", error);
    return { success: false, error: "Failed to restore backup" };
  }
}
