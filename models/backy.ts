/**
 * Backy remote backup integration model.
 * Pure business logic — no React, no DOM, no DB.
 *
 * Ported from ../zhe/models/backy.ts, adapted for neo's
 * secret-based backup format.
 */

// ── Types ────────────────────────────────────────────────────────────────────

/** Backy configuration stored in user_settings */
export interface BackyConfig {
  webhookUrl: string;
  apiKey: string;
}

/** Backy pull webhook credentials — our endpoint that Backy calls */
export interface BackyPullWebhook {
  key: string;
}

/** Backy backup history response from the remote API */
export interface BackyHistoryResponse {
  project_name: string;
  environment: string | null;
  total_backups: number;
  recent_backups: BackyBackupEntry[];
}

/** A single backup entry in the history */
export interface BackyBackupEntry {
  id: string;
  tag: string;
  environment: string;
  file_size: number;
  is_single_json: number;
  created_at: string;
}

/** Detailed push result with request metadata and timing */
export interface BackyPushDetail {
  ok: boolean;
  message: string;
  /** Duration of the push in milliseconds */
  durationMs?: number;
  request?: {
    tag: string;
    fileName: string;
    fileSizeBytes: number;
    secretCount: number;
  };
  response?: {
    status: number;
    body: unknown;
  };
  /** Backup history fetched inline on push success (avoids extra round-trip) */
  history?: BackyHistoryResponse;
}

// ── Validation ───────────────────────────────────────────────────────────────

/** Check whether a string looks like a valid webhook URL */
export function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/** Validate Backy config (both fields must be non-empty, URL must be valid) */
export function validateBackyConfig(
  config: Partial<BackyConfig>,
): { valid: true } | { valid: false; error: string } {
  if (!config.webhookUrl?.trim()) {
    return { valid: false, error: "Webhook URL is required" };
  }
  if (!isValidWebhookUrl(config.webhookUrl)) {
    return { valid: false, error: "Webhook URL is not a valid URL" };
  }
  if (!config.apiKey?.trim()) {
    return { valid: false, error: "API Key is required" };
  }
  return { valid: true };
}

// ── API Key Masking ──────────────────────────────────────────────────────────

/**
 * Mask an API key for display: show first 4 and last 4 chars, mask the rest.
 * Keys shorter than 10 chars are fully masked.
 */
export function maskApiKey(key: string): string {
  if (key.length < 10) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(key.length - 8) + key.slice(-4);
}

// ── Environment Detection ────────────────────────────────────────────────────

/** Derive the environment string from NODE_ENV */
export function getBackyEnvironment(): "prod" | "dev" {
  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}

// ── Backup Tag Builder ───────────────────────────────────────────────────────

/**
 * Build a Backy backup tag for neo.
 * Format: v{version}-{date}-{secretCount}secrets
 *
 * @param version     App version (e.g. "0.8.0")
 * @param secretCount Number of secrets in the backup
 * @param date        Optional ISO date string (defaults to today)
 */
export function buildBackyTag(
  version: string,
  secretCount: number,
  date?: string,
): string {
  const d = date ?? new Date().toISOString().slice(0, 10);
  return `v${version}-${d}-${secretCount}secrets`;
}

// ── File Size Formatting ─────────────────────────────────────────────────────

/** Format a byte count to a human-readable string (e.g. "1.2 MB") */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Time Formatting ──────────────────────────────────────────────────────────

/** Format a date string or Date as a relative time (e.g. "3 days ago") */
export function formatTimeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
