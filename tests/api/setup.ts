/**
 * API E2E test setup.
 *
 * Provides a mock ScopedDB backed by in-memory storage so that
 * Server Actions can be called end-to-end without a real D1 database.
 * Unlike unit tests (which mock individual ScopedDB methods),
 * API E2E tests let the Action → ScopedDB flow execute, only
 * replacing the D1 HTTP layer.
 */

import {
  getMockSecrets,
  getMockBackups,
  getMockUserSettings,
  clearMockStorage,
} from "@/tests/mocks/db-storage";
import type { Secret, Backup, UserSettings } from "@/models/types";

// ── Types for internal storage rows ──────────────────────────────────────

interface MockSecretRow {
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
  color?: string | null;
  created_at: number;
  updated_at: number;
}

// ── In-memory ScopedDB that operates on mock storage ─────────────────────

export class MockScopedDB {
  constructor(private readonly userId: string) {}

  private get secrets(): MockSecretRow[] {
    return getMockSecrets();
  }

  private get backups() {
    return getMockBackups();
  }

  private get settings() {
    return getMockUserSettings();
  }

  // ── Secrets ──────────────────────────────────────────────────────────

  async getSecrets(): Promise<Secret[]> {
    return this.secrets
      .filter((s) => s.user_id === this.userId)
      .sort((a, b) => b.created_at - a.created_at)
      .map(this.toSecret);
  }

  async getSecretById(id: string): Promise<Secret | null> {
    const row = this.secrets.find(
      (s) => s.id === id && s.user_id === this.userId
    );
    return row ? this.toSecret(row) : null;
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
  }): Promise<Secret> {
    const now = Math.floor(Date.now() / 1000);
    const row: MockSecretRow = {
      ...data,
      user_id: this.userId,
      created_at: now,
      updated_at: now,
    };
    this.secrets.push(row);
    return this.toSecret(row);
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
    }>
  ): Promise<Secret | null> {
    const row = this.secrets.find(
      (s) => s.id === id && s.user_id === this.userId
    );
    if (!row) return null;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        (row as Record<string, unknown>)[key] = value;
      }
    }
    row.updated_at = Math.floor(Date.now() / 1000);
    return this.toSecret(row);
  }

  async deleteSecret(id: string): Promise<boolean> {
    const idx = this.secrets.findIndex(
      (s) => s.id === id && s.user_id === this.userId
    );
    if (idx >= 0) this.secrets.splice(idx, 1);
    return true;
  }

  async getSecretCount(): Promise<number> {
    return this.secrets.filter((s) => s.user_id === this.userId).length;
  }

  // ── Backups ──────────────────────────────────────────────────────────

  async getBackups(): Promise<Backup[]> {
    return this.backups
      .filter((b) => b.user_id === this.userId)
      .sort((a, b) => b.created_at - a.created_at)
      .map(this.toBackup);
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
    const row = {
      id: data.id,
      user_id: this.userId,
      filename: data.filename,
      data: data.data,
      secret_count: data.secretCount,
      encrypted: data.encrypted ? 1 : 0,
      reason: data.reason,
      hash: data.hash,
      created_at: now,
    };
    this.backups.push(row);
    return this.toBackup(row);
  }

  async getBackupCount(): Promise<number> {
    return this.backups.filter((b) => b.user_id === this.userId).length;
  }

  async getLatestBackup(): Promise<Backup | null> {
    const userBackups = this.backups
      .filter((b) => b.user_id === this.userId)
      .sort((a, b) => b.created_at - a.created_at);
    return userBackups[0] ? this.toBackup(userBackups[0]) : null;
  }

  async deleteOldBackups(keepCount: number): Promise<number> {
    const userBackups = this.backups
      .filter((b) => b.user_id === this.userId)
      .sort((a, b) => b.created_at - a.created_at);

    const toDelete = userBackups.slice(keepCount);
    const deleteIds = new Set(toDelete.map((b) => b.id));

    const before = this.backups.length;
    const remaining = this.backups.filter((b) => !deleteIds.has(b.id));
    this.backups.splice(0, this.backups.length, ...remaining);
    return before - remaining.length;
  }

  // ── Settings ─────────────────────────────────────────────────────────

  async getUserSettings(): Promise<UserSettings | null> {
    const row = this.settings.find((s) => s.user_id === this.userId);
    return row ? this.toSettings(row) : null;
  }

  async upsertUserSettings(data: Partial<{
    encryptionKeyHash: string | null;
    theme: string;
    language: string;
  }>): Promise<UserSettings> {
    const existing = this.settings.find((s) => s.user_id === this.userId);

    if (existing) {
      if (data.encryptionKeyHash !== undefined)
        existing.encryption_key_hash = data.encryptionKeyHash;
      if (data.theme !== undefined) existing.theme = data.theme;
      if (data.language !== undefined) existing.language = data.language;
      return this.toSettings(existing);
    }

    const row = {
      user_id: this.userId,
      encryption_key_hash: data.encryptionKeyHash ?? null,
      theme: data.theme ?? "system",
      language: data.language ?? "en",
    };
    this.settings.push(row);
    return this.toSettings(row);
  }

  // ── Mappers ──────────────────────────────────────────────────────────

  private toSecret(row: MockSecretRow): Secret {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      account: row.account,
      secret: row.secret,
      type: row.type as "totp" | "hotp",
      digits: row.digits,
      period: row.period,
      algorithm: row.algorithm as "SHA1" | "SHA256" | "SHA512",
      counter: row.counter,
      color: row.color ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toBackup(row: {
    id: string;
    user_id: string;
    filename: string;
    data: string;
    secret_count: number;
    encrypted: number;
    reason: string;
    hash: string;
    created_at: number;
  }): Backup {
    return {
      id: row.id,
      userId: row.user_id,
      filename: row.filename,
      data: row.data,
      secretCount: row.secret_count,
      encrypted: row.encrypted === 1,
      reason: row.reason,
      hash: row.hash,
      createdAt: row.created_at,
    };
  }

  private toSettings(row: {
    user_id: string;
    encryption_key_hash: string | null;
    theme: string;
    language: string;
  }): UserSettings {
    return {
      userId: row.user_id,
      encryptionKeyHash: row.encryption_key_hash,
      theme: row.theme,
      language: row.language,
    };
  }
}

// ── Shared setup helpers ─────────────────────────────────────────────────

export const TEST_USER_ID = "e2e-test-user";

/** Create a MockScopedDB for the test user (call from vi.mock factory). */
export function createMockScopedDB() {
  return new MockScopedDB(TEST_USER_ID);
}

/** Reset in-memory storage between tests. */
export function resetStorage() {
  clearMockStorage();
}
