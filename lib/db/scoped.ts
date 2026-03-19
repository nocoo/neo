/**
 * ScopedDB — userId bound at construction time.
 * All user data access MUST go through ScopedDB methods,
 * which enforce the user_id condition in every SQL query.
 */

import { executeD1Query } from "./d1-client";
import { rowToSecret, rowToBackup, rowToUserSettings } from "./mappers";
import type { Secret, Backup, UserSettings } from "@/models/types";

export class ScopedDB {
  constructor(private readonly userId: string) {}

  // ── Secrets ──────────────────────────────────────────────────────────────

  async getSecrets(): Promise<Secret[]> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM secrets WHERE user_id = ? ORDER BY created_at DESC",
      [this.userId]
    );
    return rows.map(rowToSecret);
  }

  async getSecretById(id: string): Promise<Secret | null> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM secrets WHERE id = ? AND user_id = ?",
      [id, this.userId]
    );
    return rows[0] ? rowToSecret(rows[0]) : null;
  }

  async createSecret(data: {
    id: string;
    name: string;
    account: string | null;
    secret: string;
    type: string;
    digits: number;
    period: number;
    algorithm: string;
    counter: number;
    color?: string | null;
  }): Promise<Secret> {
    const now = Math.floor(Date.now() / 1000);
    const rows = await executeD1Query<Record<string, unknown>>(
      `INSERT INTO secrets (id, user_id, name, account, secret, type, digits, period, algorithm, counter, color, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        data.id,
        this.userId,
        data.name,
        data.account,
        data.secret,
        data.type,
        data.digits,
        data.period,
        data.algorithm,
        data.counter,
        data.color ?? null,
        now,
        now,
      ]
    );
    return rowToSecret(rows[0]);
  }

  async updateSecret(
    id: string,
    data: Partial<{
      name: string;
      account: string | null;
      secret: string;
      type: string;
      digits: number;
      period: number;
      algorithm: string;
      counter: number;
      color: string | null;
    }>
  ): Promise<Secret | null> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        setClauses.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (setClauses.length === 0) return this.getSecretById(id);

    setClauses.push("updated_at = ?");
    params.push(Math.floor(Date.now() / 1000));
    params.push(id, this.userId);

    const rows = await executeD1Query<Record<string, unknown>>(
      `UPDATE secrets SET ${setClauses.join(", ")} WHERE id = ? AND user_id = ? RETURNING *`,
      params
    );
    return rows[0] ? rowToSecret(rows[0]) : null;
  }

  async deleteSecret(id: string): Promise<boolean> {
    await executeD1Query(
      "DELETE FROM secrets WHERE id = ? AND user_id = ?",
      [id, this.userId]
    );
    return true;
  }

  async getSecretCount(): Promise<number> {
    const rows = await executeD1Query<{ count: number }>(
      "SELECT COUNT(*) as count FROM secrets WHERE user_id = ?",
      [this.userId]
    );
    return rows[0]?.count ?? 0;
  }

  // ── Backups ──────────────────────────────────────────────────────────────

  async getBackups(): Promise<Backup[]> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC",
      [this.userId]
    );
    return rows.map(rowToBackup);
  }

  async createBackup(data: {
    id: string;
    filename: string;
    data: string;
    secretCount: number;
    encrypted: boolean;
    reason: string;
    hash: string;
  }): Promise<Backup> {
    const now = Math.floor(Date.now() / 1000);
    const rows = await executeD1Query<Record<string, unknown>>(
      `INSERT INTO backups (id, user_id, filename, data, secret_count, encrypted, reason, hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING *`,
      [
        data.id,
        this.userId,
        data.filename,
        data.data,
        data.secretCount,
        data.encrypted ? 1 : 0,
        data.reason,
        data.hash,
        now,
      ]
    );
    return rowToBackup(rows[0]);
  }

  async getBackupCount(): Promise<number> {
    const rows = await executeD1Query<{ count: number }>(
      "SELECT COUNT(*) as count FROM backups WHERE user_id = ?",
      [this.userId]
    );
    return rows[0]?.count ?? 0;
  }

  async getLatestBackup(): Promise<Backup | null> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT 1",
      [this.userId]
    );
    return rows[0] ? rowToBackup(rows[0]) : null;
  }

  async deleteOldBackups(keepCount: number): Promise<number> {
    // Count total before deletion
    const totalBefore = await this.getBackupCount();
    if (totalBefore <= keepCount) return 0;

    // Get IDs of backups to keep (most recent N)
    const keepers = await executeD1Query<{ id: string }>(
      "SELECT id FROM backups WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
      [this.userId, keepCount]
    );
    const keepIds = keepers.map((r) => r.id);

    if (keepIds.length === 0) return 0;

    const placeholders = keepIds.map(() => "?").join(",");
    await executeD1Query(
      `DELETE FROM backups WHERE user_id = ? AND id NOT IN (${placeholders})`,
      [this.userId, ...keepIds]
    );

    // Count after deletion to get actual deleted count
    const totalAfter = await this.getBackupCount();
    return totalBefore - totalAfter;
  }

  // ── User Settings ────────────────────────────────────────────────────────

  async getUserSettings(): Promise<UserSettings | null> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM user_settings WHERE user_id = ?",
      [this.userId]
    );
    return rows[0] ? rowToUserSettings(rows[0]) : null;
  }

  async upsertUserSettings(data: Partial<{
    encryptionKeyHash: string | null;
    theme: string;
    language: string;
  }>): Promise<UserSettings> {
    const existing = await this.getUserSettings();

    if (existing) {
      const setClauses: string[] = [];
      const params: unknown[] = [];

      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          // Map camelCase to snake_case
          const col = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          setClauses.push(`${col} = ?`);
          params.push(value);
        }
      }

      if (setClauses.length > 0) {
        params.push(this.userId);
        const rows = await executeD1Query<Record<string, unknown>>(
          `UPDATE user_settings SET ${setClauses.join(", ")} WHERE user_id = ? RETURNING *`,
          params
        );
        return rowToUserSettings(rows[0]);
      }
      return existing;
    }

    const rows = await executeD1Query<Record<string, unknown>>(
      `INSERT INTO user_settings (user_id, encryption_key_hash, theme, language)
       VALUES (?, ?, ?, ?)
       RETURNING *`,
      [
        this.userId,
        data.encryptionKeyHash ?? null,
        data.theme ?? "system",
        data.language ?? "en",
      ]
    );
    return rowToUserSettings(rows[0]);
  }
}
