/**
 * Core application types.
 * Zero React dependency — pure TypeScript interfaces.
 */

import type { OtpType, OtpAlgorithm } from "./constants";

// ── ActionResult ─────────────────────────────────────────────────────────────

/** Unified return type for all Server Actions */
export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Secret ───────────────────────────────────────────────────────────────────

/** A 2FA secret stored in the database */
export interface Secret {
  id: string;
  userId: string;
  name: string;
  account: string | null;
  secret: string;
  type: OtpType;
  digits: number;
  period: number;
  algorithm: OtpAlgorithm;
  counter: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Input for creating a new secret */
export interface CreateSecretInput {
  name: string;
  account?: string;
  secret: string;
  type?: OtpType;
  digits?: number;
  period?: number;
  algorithm?: OtpAlgorithm;
  counter?: number;
}

/** Input for updating an existing secret */
export interface UpdateSecretInput {
  id: string;
  name?: string;
  account?: string;
  secret?: string;
  type?: OtpType;
  digits?: number;
  period?: number;
  algorithm?: OtpAlgorithm;
  counter?: number;
}

// ── Backup ───────────────────────────────────────────────────────────────────

/** A backup record */
export interface Backup {
  id: string;
  userId: string;
  filename: string;
  data: string;
  secretCount: number;
  encrypted: boolean;
  reason: string;
  hash: string;
  createdAt: Date;
}

// ── User Settings ────────────────────────────────────────────────────────────

/** User-specific settings */
export interface UserSettings {
  userId: string;
  encryptionKeyHash: string | null;
  theme: string;
  language: string;
}

// ── Import/Export ────────────────────────────────────────────────────────────

/** Parsed secret from an import file */
export interface ParsedSecret {
  name: string;
  account: string;
  secret: string;
  type: OtpType;
  digits: number;
  period: number;
  algorithm: OtpAlgorithm;
  counter: number;
}

/** Supported import formats */
export type ImportFormat =
  | "otpauth-uri"
  | "aegis"
  | "aegis-encrypted"
  | "andotp"
  | "andotp-encrypted"
  | "2fas"
  | "authenticator-pro"
  | "authenticator-pro-encrypted"
  | "bitwarden"
  | "ente-auth"
  | "freeotp"
  | "freeotp-plus"
  | "google-authenticator"
  | "lastpass"
  | "proton"
  | "winauth"
  | "totp-auth"
  | "raivo"
  | "generic-json"
  | "generic-csv";

/** Supported export formats */
export type ExportFormat =
  | "otpauth-uri"
  | "aegis"
  | "andotp"
  | "2fas"
  | "authenticator-pro"
  | "bitwarden"
  | "ente-auth"
  | "freeotp"
  | "freeotp-plus"
  | "google-authenticator"
  | "lastpass"
  | "proton"
  | "winauth"
  | "totp-auth"
  | "generic-json"
  | "generic-csv"
  | "generic-txt";

// ── OTP ──────────────────────────────────────────────────────────────────────

/** Generated OTP result */
export interface OtpResult {
  otp: string;
  remainingSeconds: number;
  period: number;
}

// ── Dashboard ────────────────────────────────────────────────────────────────

/** Dashboard aggregate data */
export interface DashboardData {
  secrets: Secret[];
  backupCount: number;
  lastBackupAt: Date | null;
  encryptionEnabled: boolean;
}
