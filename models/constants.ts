/**
 * Single-source constants for the entire application.
 * Fixes P2: eliminates duplicate hardcoded values across modules.
 */

// ── OTP ──────────────────────────────────────────────────────────────────────

/** Supported OTP types */
export const OTP_TYPES = ["totp", "hotp"] as const;
export type OtpType = (typeof OTP_TYPES)[number];

/** Supported hash algorithms */
export const OTP_ALGORITHMS = ["SHA-1", "SHA-256", "SHA-512"] as const;
export type OtpAlgorithm = (typeof OTP_ALGORITHMS)[number];

/** Default OTP parameters */
export const OTP_DEFAULTS = {
  type: "totp" as OtpType,
  digits: 6,
  period: 30,
  algorithm: "SHA-1" as OtpAlgorithm,
  counter: 0,
} as const;

/** Valid digit counts */
export const OTP_DIGIT_OPTIONS = [6, 8] as const;

/** Valid period values (seconds) */
export const OTP_PERIOD_OPTIONS = [30, 60] as const;

// ── Encryption ───────────────────────────────────────────────────────────────

/** AES-GCM key length in bits */
export const AES_KEY_LENGTH = 256;

/** AES-GCM IV length in bytes */
export const AES_IV_LENGTH = 12;

/** Encrypted value format prefix */
export const ENCRYPTION_PREFIX = "v1:";

// ── Backup ───────────────────────────────────────────────────────────────────

/** Debounce interval for event-driven backups (ms) */
export const BACKUP_DEBOUNCE_MS = 5 * 60 * 1000;

/** Maximum number of backups to retain */
export const BACKUP_MAX_COUNT = 100;

/** Cron schedule for daily backup (UTC) */
export const BACKUP_CRON_SCHEDULE = "0 16 * * *";

// ── Import/Export ────────────────────────────────────────────────────────────

/** Maximum number of secrets per batch import */
export const BATCH_IMPORT_LIMIT = 100;

// ── Rate Limiting ────────────────────────────────────────────────────────────

/** Rate limit presets */
export const RATE_LIMIT_PRESETS = {
  strict: { maxRequests: 5, windowMs: 60_000 },
  normal: { maxRequests: 20, windowMs: 60_000 },
  relaxed: { maxRequests: 100, windowMs: 60_000 },
  api: { maxRequests: 30, windowMs: 60_000 },
  otp: { maxRequests: 60, windowMs: 60_000 },
} as const;

// ── Application ──────────────────────────────────────────────────────────────

/** Application name */
export const APP_NAME = "Neo";

/** Dev server port */
export const DEV_PORT = 7021;

/** Worker dev port */
export const WORKER_PORT = 8787;
