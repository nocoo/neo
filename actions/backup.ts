"use server";

/**
 * Backup Server Actions.
 *
 * All actions return ActionResult<T> — never throw.
 */

import { getScopedDB } from "@/lib/auth-context";
import { generateBackupFilename } from "@/models/backup";
import { BACKUP_MAX_COUNT } from "@/models/constants";
import type { ActionResult, Backup } from "@/models/types";

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
