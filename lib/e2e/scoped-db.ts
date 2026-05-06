/**
 * In-memory ScopedDB implementation for E2E testing.
 *
 * Drop-in replacement for `lib/db/scoped.ts` ScopedDB — same public API,
 * but backed by process-level in-memory arrays instead of Cloudflare D1.
 * Storage persists across HTTP requests within the same dev server process,
 * which is exactly what the E2E test runner needs (create → list within a test).
 *
 * Used only when isE2EMode() returns true (NODE_ENV !== "production" && E2E_SKIP_AUTH=true).
 */

import type { Secret, UserSettings } from "@/models/types";
import type { OtpAlgorithm, OtpType } from "@/models/constants";

// ── In-memory storage (process-level, survives across requests) ─────────────

interface SecretRow {
  id: string;
  user_id: string;
  name: string;
  account: string | null;
  secret: string;
  type: string;
  digits: number;
  period: number;
  algorithm: string;
  counter: number;
  color: string | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

interface SettingsRow {
  user_id: string;
  encryption_key_hash: string | null;
  encryption_key: string | null;
  backy_webhook_url: string | null;
  backy_api_key: string | null;
  backy_pull_key: string | null;
  theme: string;
  language: string;
}

let secrets: SecretRow[] = [];
let settings: SettingsRow[] = [];

/** Reset all in-memory storage. Called by /api/e2e/reset if needed. */
export function resetE2EStorage(): void {
  secrets = [];
  settings = [];
}

// ── E2E ScopedDB ────────────────────────────────────────────────────────────

export class E2eScopedDB {
  constructor(private readonly userId: string) {}

  // ── Secrets ──────────────────────────────────────────────────────────────

  async getSecrets(): Promise<Secret[]> {
    return secrets
      .filter((s) => s.user_id === this.userId && s.deleted_at === null)
      .sort((a, b) => b.created_at - a.created_at)
      .map(rowToSecret);
  }

  async getSecretById(id: string): Promise<Secret | null> {
    const row = secrets.find(
      (s) => s.id === id && s.user_id === this.userId && s.deleted_at === null
    );
    return row ? rowToSecret(row) : null;
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
    const row: SecretRow = {
      id: data.id,
      user_id: this.userId,
      name: data.name,
      account: data.account,
      secret: data.secret,
      type: data.type,
      digits: data.digits,
      period: data.period,
      algorithm: data.algorithm,
      counter: data.counter,
      color: data.color ?? null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    };
    secrets.push(row);
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
    const row = secrets.find(
      (s) => s.id === id && s.user_id === this.userId && s.deleted_at === null
    );
    if (!row) return null;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (row as unknown as Record<string, unknown>)[key] = value;
      }
    }
    row.updated_at = Math.floor(Date.now() / 1000);
    return rowToSecret(row);
  }

  async deleteSecret(id: string): Promise<boolean> {
    const row = secrets.find(
      (s) => s.id === id && s.user_id === this.userId && s.deleted_at === null
    );
    if (row) {
      const now = Math.floor(Date.now() / 1000);
      row.deleted_at = now;
      row.updated_at = now;
    }
    return true;
  }

  async getDeletedSecrets(): Promise<Secret[]> {
    return secrets
      .filter((s) => s.user_id === this.userId && s.deleted_at !== null)
      .sort((a, b) => (b.deleted_at ?? 0) - (a.deleted_at ?? 0))
      .map(rowToSecret);
  }

  async restoreSecret(id: string): Promise<Secret | null> {
    const row = secrets.find(
      (s) => s.id === id && s.user_id === this.userId && s.deleted_at !== null
    );
    if (!row) return null;
    row.deleted_at = null;
    row.updated_at = Math.floor(Date.now() / 1000);
    return rowToSecret(row);
  }

  async permanentDeleteSecret(id: string): Promise<boolean> {
    const idx = secrets.findIndex(
      (s) => s.id === id && s.user_id === this.userId && s.deleted_at !== null
    );
    if (idx >= 0) secrets.splice(idx, 1);
    return true;
  }

  async emptyRecycleBin(): Promise<number> {
    const toDelete = secrets.filter(
      (s) => s.user_id === this.userId && s.deleted_at !== null
    );
    const count = toDelete.length;
    secrets = secrets.filter(
      (s) => !(s.user_id === this.userId && s.deleted_at !== null)
    );
    return count;
  }

  async getSecretCount(): Promise<number> {
    return secrets.filter(
      (s) => s.user_id === this.userId && s.deleted_at === null
    ).length;
  }

  // ── User Settings ────────────────────────────────────────────────────────

  async getUserSettings(): Promise<UserSettings | null> {
    const row = settings.find((s) => s.user_id === this.userId);
    return row ? rowToSettings(row) : null;
  }

  async upsertUserSettings(data: Partial<{
    encryptionKeyHash: string | null;
    theme: string;
    language: string;
  }>): Promise<UserSettings> {
    const existing = settings.find((s) => s.user_id === this.userId);

    if (existing) {
      if (data.encryptionKeyHash !== undefined)
        existing.encryption_key_hash = data.encryptionKeyHash;
      if (data.theme !== undefined) existing.theme = data.theme;
      if (data.language !== undefined) existing.language = data.language;
      return rowToSettings(existing);
    }

    const row: SettingsRow = {
      user_id: this.userId,
      encryption_key_hash: data.encryptionKeyHash ?? null,
      encryption_key: null,
      backy_webhook_url: null,
      backy_api_key: null,
      backy_pull_key: null,
      theme: data.theme ?? "system",
      language: data.language ?? "en",
    };
    settings.push(row);
    return rowToSettings(row);
  }

  // ── Encryption Key ───────────────────────────────────────────────────────

  async getEncryptionKey(): Promise<string | null> {
    const row = settings.find((s) => s.user_id === this.userId);
    return row?.encryption_key ?? null;
  }

  async setEncryptionKey(key: string): Promise<void> {
    const existing = settings.find((s) => s.user_id === this.userId);
    if (existing) {
      existing.encryption_key = key;
    } else {
      settings.push({
        user_id: this.userId,
        encryption_key_hash: null,
        encryption_key: key,
        backy_webhook_url: null,
        backy_api_key: null,
        backy_pull_key: null,
        theme: "system",
        language: "en",
      });
    }
  }

  // ── Backy Settings ───────────────────────────────────────────────────────

  async getBackySettings(): Promise<{ webhookUrl: string | null; apiKey: string | null }> {
    const row = settings.find((s) => s.user_id === this.userId);
    return {
      webhookUrl: row?.backy_webhook_url ?? null,
      apiKey: row?.backy_api_key ?? null,
    };
  }

  async upsertBackySettings(data: { webhookUrl: string; apiKey: string }): Promise<void> {
    const existing = settings.find((s) => s.user_id === this.userId);
    if (existing) {
      existing.backy_webhook_url = data.webhookUrl;
      existing.backy_api_key = data.apiKey;
    } else {
      settings.push({
        user_id: this.userId,
        encryption_key_hash: null,
        encryption_key: null,
        backy_webhook_url: data.webhookUrl,
        backy_api_key: data.apiKey,
        backy_pull_key: null,
        theme: "system",
        language: "en",
      });
    }
  }

  // ── Backy Pull Webhook ───────────────────────────────────────────────────

  async getBackyPullWebhook(): Promise<string | null> {
    const row = settings.find((s) => s.user_id === this.userId);
    return row?.backy_pull_key ?? null;
  }

  async upsertBackyPullWebhook(key: string): Promise<void> {
    const existing = settings.find((s) => s.user_id === this.userId);
    if (existing) {
      existing.backy_pull_key = key;
    } else {
      settings.push({
        user_id: this.userId,
        encryption_key_hash: null,
        encryption_key: null,
        backy_webhook_url: null,
        backy_api_key: null,
        backy_pull_key: key,
        theme: "system",
        language: "en",
      });
    }
  }

  async deleteBackyPullWebhook(): Promise<void> {
    const existing = settings.find((s) => s.user_id === this.userId);
    if (existing) {
      existing.backy_pull_key = null;
    }
  }

  // ── Legacy Backups (stub — no legacy data in E2E) ────────────────────────

  async getLegacyBackupCount(): Promise<number> {
    return 0;
  }

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
    return [];
  }
}

// ── Row-to-type mappers ─────────────────────────────────────────────────────

function rowToSecret(row: SecretRow): Secret {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    account: row.account,
    secret: row.secret,
    type: row.type as OtpType,
    digits: row.digits,
    period: row.period,
    algorithm: row.algorithm as OtpAlgorithm,
    counter: row.counter,
    color: row.color,
    deletedAt: row.deleted_at ? new Date(row.deleted_at * 1000) : null,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

function rowToSettings(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    encryptionKeyHash: row.encryption_key_hash,
    encryptionKey: row.encryption_key,
    backyWebhookUrl: row.backy_webhook_url,
    backyApiKey: row.backy_api_key,
    backyPullKey: row.backy_pull_key,
    theme: row.theme,
    language: row.language,
  };
}
