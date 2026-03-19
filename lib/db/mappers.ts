/**
 * D1 row-to-type mappers.
 * Converts raw D1 query results to typed application objects.
 */

import type { Secret, Backup, UserSettings } from "@/models/types";

export function rowToSecret(row: Record<string, unknown>): Secret {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    account: (row.account as string | null) ?? null,
    secret: row.secret as string,
    type: (row.type as Secret["type"]) || "totp",
    digits: (row.digits as number) || 6,
    period: (row.period as number) || 30,
    algorithm: (row.algorithm as Secret["algorithm"]) || "SHA-1",
    counter: (row.counter as number) || 0,
    createdAt: new Date((row.created_at as number) * 1000),
    updatedAt: new Date((row.updated_at as number) * 1000),
  };
}

export function rowToBackup(row: Record<string, unknown>): Backup {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    filename: row.filename as string,
    data: row.data as string,
    secretCount: row.secret_count as number,
    encrypted: !!(row.encrypted as number),
    reason: row.reason as string,
    hash: row.hash as string,
    createdAt: new Date((row.created_at as number) * 1000),
  };
}

export function rowToUserSettings(row: Record<string, unknown>): UserSettings {
  return {
    userId: row.user_id as string,
    encryptionKeyHash: (row.encryption_key_hash as string | null) ?? null,
    theme: (row.theme as string) || "system",
    language: (row.language as string) || "en",
  };
}
