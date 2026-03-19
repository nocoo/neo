/**
 * Cron daily backup via D1.
 *
 * Flow:
 *   1. For each user, query all secrets from D1
 *   2. Compute SHA-256 hash of secrets data
 *   3. Compare with latest backup hash — skip if unchanged
 *   4. Optionally encrypt backup data (AES-GCM 256-bit)
 *   5. Insert new backup row into D1
 *   6. Clean up old backups (retain latest 100 per user)
 */

import type { Env } from "./types";
import { sha256Hex, encryptAesGcm } from "./utils/crypto";
import { generateId } from "./utils/id";

/** Maximum number of backups to retain per user. */
const MAX_BACKUPS = 100;

/** Secret row shape from D1 query. */
interface SecretRow {
  id: string;
  name: string;
  account: string | null;
  secret: string;
  type: string;
  digits: number;
  period: number;
  algorithm: string;
  counter: number;
}

/**
 * Compute SHA-256 hash of secrets data for change detection.
 *
 * Only includes OTP-relevant fields (not timestamps) to avoid
 * spurious backups from metadata-only changes.
 */
export async function computeSecretsHash(
  secrets: SecretRow[]
): Promise<string> {
  const hashData = secrets
    .map((s) => ({
      id: s.id,
      name: s.name,
      account: s.account,
      secret: s.secret,
      type: s.type,
      digits: s.digits,
      period: s.period,
      algorithm: s.algorithm,
      counter: s.counter,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return sha256Hex(JSON.stringify(hashData));
}

/** Generate a timestamped backup filename. */
export function generateBackupFilename(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const date = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`;
  const time = `${pad(now.getUTCHours())}-${pad(now.getUTCMinutes())}-${pad(now.getUTCSeconds())}`;
  return `backup_${date}_${time}.json`;
}

/**
 * Run cron daily backup for all users.
 *
 * For each user:
 *   1. Query their secrets
 *   2. Compute hash, compare with latest backup
 *   3. Create new backup if data changed
 *   4. Cleanup old backups beyond retention limit
 */
export async function runCronBackup(env: Env): Promise<void> {
  // Get all user IDs that have secrets
  const usersResult = await env.DB.prepare(
    "SELECT DISTINCT user_id FROM secrets"
  ).all<{ user_id: string }>();

  if (!usersResult.results || usersResult.results.length === 0) {
    return;
  }

  for (const { user_id } of usersResult.results) {
    await backupUserSecrets(user_id, env);
  }
}

/**
 * Backup secrets for a single user.
 * Skips if data hasn't changed since last backup.
 */
export async function backupUserSecrets(
  userId: string,
  env: Env
): Promise<{ created: boolean; reason?: string }> {
  // 1. Query user's secrets
  const secretsResult = await env.DB.prepare(
    "SELECT id, name, account, secret, type, digits, period, algorithm, counter FROM secrets WHERE user_id = ?"
  )
    .bind(userId)
    .all<SecretRow>();

  const secrets = secretsResult.results ?? [];

  if (secrets.length === 0) {
    return { created: false, reason: "no_secrets" };
  }

  // 2. Compute current hash
  const currentHash = await computeSecretsHash(secrets);

  // 3. Get latest backup hash for this user
  const latestBackup = await env.DB.prepare(
    "SELECT hash FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 1"
  )
    .bind(userId)
    .first<{ hash: string }>();

  if (latestBackup && latestBackup.hash === currentHash) {
    return { created: false, reason: "unchanged" };
  }

  // 4. Build backup data
  const backupData = JSON.stringify({
    timestamp: new Date().toISOString(),
    version: "1.0",
    count: secrets.length,
    secrets,
  });

  // 5. Optionally encrypt
  let finalData: string;
  let encrypted = 0;

  if (env.ENCRYPTION_KEY) {
    finalData = await encryptAesGcm(backupData, env.ENCRYPTION_KEY);
    encrypted = 1;
  } else {
    finalData = backupData;
  }

  // 6. Insert backup row
  const backupId = generateId("bk");
  const filename = generateBackupFilename();
  const now = Math.floor(Date.now() / 1000);

  await env.DB.prepare(
    "INSERT INTO backups (id, user_id, filename, data, secret_count, encrypted, reason, hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(backupId, userId, filename, finalData, secrets.length, encrypted, "cron", currentHash, now)
    .run();

  // 7. Cleanup old backups
  await cleanupOldBackups(userId, env);

  return { created: true };
}

/**
 * Delete old backups beyond the retention limit.
 * Keeps the newest MAX_BACKUPS per user.
 */
export async function cleanupOldBackups(
  userId: string,
  env: Env
): Promise<number> {
  // Count total backups for user
  const countResult = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM backups WHERE user_id = ?"
  )
    .bind(userId)
    .first<{ count: number }>();

  const total = countResult?.count ?? 0;

  if (total <= MAX_BACKUPS) {
    return 0;
  }

  // Get IDs of backups to delete (oldest ones beyond limit)
  const toDeleteResult = await env.DB.prepare(
    "SELECT id FROM backups WHERE user_id = ? ORDER BY created_at ASC LIMIT ?"
  )
    .bind(userId, total - MAX_BACKUPS)
    .all<{ id: string }>();

  const ids = toDeleteResult.results?.map((r) => r.id) ?? [];

  if (ids.length === 0) {
    return 0;
  }

  // Delete in batches (D1 has query size limits)
  const batchSize = 50;
  let deleted = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const placeholders = batch.map(() => "?").join(",");
    await env.DB.prepare(
      `DELETE FROM backups WHERE id IN (${placeholders})`
    )
      .bind(...batch)
      .run();
    deleted += batch.length;
  }

  return deleted;
}
