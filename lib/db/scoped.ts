/**
 * ScopedDB — userId bound at construction time.
 * All user data access MUST go through ScopedDB methods,
 * which enforce the user_id condition in every SQL query.
 */

import { executeD1Query } from "./d1-client";
import { rowToSecret, rowToUserSettings } from "./mappers";
import type { Secret, UserSettings } from "@/models/types";

export class ScopedDB {
  constructor(private readonly userId: string) {}

  // ── Secrets ──────────────────────────────────────────────────────────────

  async getSecrets(): Promise<Secret[]> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM secrets WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
      [this.userId]
    );
    return rows.map(rowToSecret);
  }

  async getSecretById(id: string): Promise<Secret | null> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM secrets WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
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
    const row = rows[0];
    if (!row) throw new Error("INSERT INTO secrets RETURNING * returned no rows");
    return rowToSecret(row);
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
    const now = Math.floor(Date.now() / 1000);
    await executeD1Query(
      "UPDATE secrets SET deleted_at = ?, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
      [now, now, id, this.userId]
    );
    return true;
  }

  async getDeletedSecrets(): Promise<Secret[]> {
    const rows = await executeD1Query<Record<string, unknown>>(
      "SELECT * FROM secrets WHERE user_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC",
      [this.userId]
    );
    return rows.map(rowToSecret);
  }

  async restoreSecret(id: string): Promise<Secret | null> {
    const now = Math.floor(Date.now() / 1000);
    const rows = await executeD1Query<Record<string, unknown>>(
      "UPDATE secrets SET deleted_at = NULL, updated_at = ? WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL RETURNING *",
      [now, id, this.userId]
    );
    return rows[0] ? rowToSecret(rows[0]) : null;
  }

  async permanentDeleteSecret(id: string): Promise<boolean> {
    await executeD1Query(
      "DELETE FROM secrets WHERE id = ? AND user_id = ? AND deleted_at IS NOT NULL",
      [id, this.userId]
    );
    return true;
  }

  async emptyRecycleBin(): Promise<number> {
    const countRows = await executeD1Query<{ count: number }>(
      "SELECT COUNT(*) as count FROM secrets WHERE user_id = ? AND deleted_at IS NOT NULL",
      [this.userId]
    );
    const count = countRows[0]?.count ?? 0;
    await executeD1Query(
      "DELETE FROM secrets WHERE user_id = ? AND deleted_at IS NOT NULL",
      [this.userId]
    );
    return count;
  }

  async getSecretCount(): Promise<number> {
    const rows = await executeD1Query<{ count: number }>(
      "SELECT COUNT(*) as count FROM secrets WHERE user_id = ? AND deleted_at IS NULL",
      [this.userId]
    );
    return rows[0]?.count ?? 0;
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
        const updatedRow = rows[0];
        if (!updatedRow) throw new Error("UPDATE user_settings RETURNING * returned no rows");
        return rowToUserSettings(updatedRow);
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
    const insertedRow = rows[0];
    if (!insertedRow) throw new Error("INSERT INTO user_settings RETURNING * returned no rows");
    return rowToUserSettings(insertedRow);
  }

  // ── Encryption Key ──────────────────────────────────────────────────────

  async getEncryptionKey(): Promise<string | null> {
    const settings = await this.getUserSettings();
    return settings?.encryptionKey ?? null;
  }

  async setEncryptionKey(key: string): Promise<void> {
    const existing = await this.getUserSettings();
    if (existing) {
      await executeD1Query(
        "UPDATE user_settings SET encryption_key = ? WHERE user_id = ?",
        [key, this.userId]
      );
    } else {
      await executeD1Query(
        `INSERT INTO user_settings (user_id, encryption_key, theme, language)
         VALUES (?, ?, 'system', 'en')`,
        [this.userId, key]
      );
    }
  }

  // ── Backy Settings ──────────────────────────────────────────────────────

  async getBackySettings(): Promise<{ webhookUrl: string | null; apiKey: string | null }> {
    const settings = await this.getUserSettings();
    return {
      webhookUrl: settings?.backyWebhookUrl ?? null,
      apiKey: settings?.backyApiKey ?? null,
    };
  }

  async upsertBackySettings(data: { webhookUrl: string; apiKey: string }): Promise<void> {
    const existing = await this.getUserSettings();
    if (existing) {
      await executeD1Query(
        "UPDATE user_settings SET backy_webhook_url = ?, backy_api_key = ? WHERE user_id = ?",
        [data.webhookUrl, data.apiKey, this.userId]
      );
    } else {
      await executeD1Query(
        `INSERT INTO user_settings (user_id, backy_webhook_url, backy_api_key, theme, language)
         VALUES (?, ?, ?, 'system', 'en')`,
        [this.userId, data.webhookUrl, data.apiKey]
      );
    }
  }

  // ── Backy Pull Webhook ──────────────────────────────────────────────────

  async getBackyPullWebhook(): Promise<string | null> {
    const settings = await this.getUserSettings();
    return settings?.backyPullKey ?? null;
  }

  async upsertBackyPullWebhook(key: string): Promise<void> {
    const existing = await this.getUserSettings();
    if (existing) {
      await executeD1Query(
        "UPDATE user_settings SET backy_pull_key = ? WHERE user_id = ?",
        [key, this.userId]
      );
    } else {
      await executeD1Query(
        `INSERT INTO user_settings (user_id, backy_pull_key, theme, language)
         VALUES (?, ?, 'system', 'en')`,
        [this.userId, key]
      );
    }
  }

  async deleteBackyPullWebhook(): Promise<void> {
    await executeD1Query(
      "UPDATE user_settings SET backy_pull_key = NULL WHERE user_id = ?",
      [this.userId]
    );
  }

  // ── Legacy Backups (read-only, for migration) ─────────────────────────────

  /**
   * Count old D1 backups for this user that are exportable (non-encrypted).
   * Returns 0 after table is dropped.
   */
  async getLegacyBackupCount(): Promise<number> {
    try {
      const rows = await executeD1Query<{ count: number }>(
        "SELECT COUNT(*) as count FROM backups WHERE user_id = ? AND encrypted = 0",
        [this.userId],
      );
      return rows[0]?.count ?? 0;
    } catch {
      // Table may not exist (dropped in Phase 7.6)
      return 0;
    }
  }

  /**
   * Read old D1 backups for migration export.
   * Returns raw rows — no mapper needed, no Backup type dependency.
   */
  async getLegacyBackups(): Promise<
    Array<{
      id: string;
      filename: string;
      data: string;
      secretCount: number;
      encrypted: boolean;
      hash: string;
      createdAt: number;
    }>
  > {
    try {
      const rows = await executeD1Query<Record<string, unknown>>(
        "SELECT id, filename, data, secret_count, encrypted, hash, created_at FROM backups WHERE user_id = ? ORDER BY created_at DESC",
        [this.userId],
      );
      return rows.map((r) => ({
        id: r.id as string,
        filename: r.filename as string,
        data: r.data as string,
        secretCount: r.secret_count as number,
        encrypted: !!(r.encrypted as number),
        hash: r.hash as string,
        createdAt: r.created_at as number,
      }));
    } catch {
      // Table may not exist (dropped in Phase 7.6)
      return [];
    }
  }
}

// ── Standalone queries (not scoped to a user) ──────────────────────────────

/**
 * Verify a Backy pull webhook key and return the associated userId.
 * Used by the pull webhook route handler where we don't have a session.
 */
export async function verifyBackyPullWebhook(
  key: string,
): Promise<{ userId: string } | null> {
  const rows = await executeD1Query<Record<string, unknown>>(
    "SELECT user_id FROM user_settings WHERE backy_pull_key = ? LIMIT 1",
    [key],
  );
  if (!rows[0]) return null;
  return { userId: rows[0].user_id as string };
}
