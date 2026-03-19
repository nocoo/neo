/**
 * Backup model — pure business logic for backup operations.
 * No database or framework dependency — operates on data passed in.
 */

import { BACKUP_MAX_COUNT, BACKUP_DEBOUNCE_MS } from "./constants";
import type { ParsedSecret } from "./types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface BackupMetadata {
  id: string;
  filename: string;
  secretCount: number;
  encrypted: boolean;
  reason: string;
  hash: string;
  createdAt: Date;
}

export interface BackupData {
  version: 1;
  createdAt: string;
  secretCount: number;
  secrets: ParsedSecret[];
}

// ── Filename ────────────────────────────────────────────────────────────────

/**
 * Generate a backup filename with timestamp.
 * Format: backup_YYYY-MM-DD_HH-MM-SS.json
 */
export function generateBackupFilename(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `backup_${y}-${m}-${d}_${h}-${mi}-${s}.json`;
}

/**
 * Validate a backup filename format.
 */
export function isValidBackupFilename(filename: string): boolean {
  return /^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/.test(filename);
}

// ── Hash ────────────────────────────────────────────────────────────────────

/**
 * Compute a simple hash string for backup deduplication.
 * Uses a fast string hash — not cryptographic, just for change detection.
 */
export function computeBackupHash(secrets: ParsedSecret[]): string {
  // Deterministic serialization: sort by name+account, include only content-significant fields
  const normalized = secrets
    .map((s) => `${s.name}|${s.account}|${s.secret}|${s.type}|${s.digits}|${s.period}|${s.algorithm}|${s.counter}`)
    .sort()
    .join("\n");

  // Simple FNV-1a 32-bit hash
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

// ── Serialization ───────────────────────────────────────────────────────────

/**
 * Serialize secrets into backup JSON.
 */
export function serializeBackup(secrets: ParsedSecret[]): string {
  const data: BackupData = {
    version: 1,
    createdAt: new Date().toISOString(),
    secretCount: secrets.length,
    secrets,
  };
  return JSON.stringify(data, null, 2);
}

/**
 * Deserialize backup JSON into secrets.
 * Returns null if format is invalid.
 */
export function deserializeBackup(json: string): ParsedSecret[] | null {
  try {
    const data = JSON.parse(json);

    // Handle version 1 format
    if (data.version === 1 && Array.isArray(data.secrets)) {
      return data.secrets;
    }

    // Handle plain array format (legacy)
    if (Array.isArray(data)) {
      return data;
    }

    // Handle {secrets: [...]} without version
    if (Array.isArray(data.secrets)) {
      return data.secrets;
    }

    return null;
  } catch {
    return null;
  }
}

// ── Debounce Logic ──────────────────────────────────────────────────────────

/**
 * Check if enough time has passed since the last backup for debounce.
 */
export function shouldDebounceBackup(
  lastBackupAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!lastBackupAt) return false; // No previous backup, don't debounce
  return now.getTime() - lastBackupAt.getTime() < BACKUP_DEBOUNCE_MS;
}

// ── Retention ───────────────────────────────────────────────────────────────

/**
 * Determine which backups to delete to stay within the retention limit.
 * Returns IDs of backups to delete (oldest first).
 */
export function getBackupsToDelete(
  backups: BackupMetadata[],
  maxCount: number = BACKUP_MAX_COUNT
): string[] {
  if (backups.length <= maxCount) return [];

  // Sort by createdAt ascending (oldest first)
  const sorted = [...backups].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const deleteCount = sorted.length - maxCount;
  return sorted.slice(0, deleteCount).map((b) => b.id);
}

/**
 * Check if the backup data has changed since the last backup.
 */
export function hasDataChanged(
  currentHash: string,
  lastBackupHash: string | null
): boolean {
  if (!lastBackupHash) return true;
  return currentHash !== lastBackupHash;
}
