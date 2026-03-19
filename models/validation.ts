/**
 * Validation module — pure functions, zero React dependency.
 * Migrated from 2fa project with TypeScript types.
 *
 * Provides Base32 validation, OTP parameter validation, secret data
 * validation, normalization, sorting, and duplicate detection.
 */

import {
  OTP_DIGIT_OPTIONS,
  BATCH_IMPORT_LIMIT,
} from "./constants";
import type { ParsedSecret } from "./types";

// ── Result Types ────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

// ── Base32 Validation ───────────────────────────────────────────────────────

const BASE32_REGEX = /^[A-Z2-7]+=*$/;
const MIN_BASE32_LENGTH = 8;
const STRONG_KEY_BITS = 128;
const WEAK_KEY_BITS = 80;

/**
 * Validate a Base32-encoded secret string.
 * Checks format, length, and key strength.
 */
export function validateBase32(secret: unknown): ValidationResult {
  if (!secret || typeof secret !== "string" || !secret.trim()) {
    return { valid: false, error: "Secret is required" };
  }

  const clean = secret.toUpperCase().trim().replace(/\s/g, "");

  if (!BASE32_REGEX.test(clean)) {
    return {
      valid: false,
      error: "Invalid Base32 format: only A-Z and 2-7 are allowed",
    };
  }

  if (clean.length < MIN_BASE32_LENGTH) {
    return {
      valid: false,
      error: `Secret too short (${clean.length} chars), minimum ${MIN_BASE32_LENGTH} required`,
    };
  }

  // Calculate decoded bit length
  const paddingCount = (clean.match(/=/g) || []).length;
  const encodedLength = clean.length - paddingCount;
  const byteLength = Math.floor((encodedLength * 5) / 8);
  const bitLength = byteLength * 8;

  if (bitLength < WEAK_KEY_BITS) {
    return {
      valid: true,
      warning: `Weak key (${bitLength}-bit). Recommend at least 128-bit (21+ chars)`,
    };
  }

  if (bitLength < STRONG_KEY_BITS) {
    return {
      valid: true,
      warning: `Moderate key (${bitLength}-bit). Recommend 128-bit or higher`,
    };
  }

  return { valid: true };
}

// ── Secret Data Validation ──────────────────────────────────────────────────

const MAX_NAME_LENGTH = 50;

/**
 * Validate a secret's name + secret fields.
 */
export function validateSecretData(data: {
  name?: string;
  secret?: string;
}): ValidationResult {
  const { name, secret } = data;

  if (!name || !name.trim()) {
    return { valid: false, error: "Service name is required" };
  }

  if (name.trim().length > MAX_NAME_LENGTH) {
    return {
      valid: false,
      error: `Service name too long (${name.trim().length} chars, max ${MAX_NAME_LENGTH})`,
    };
  }

  if (!secret || !secret.trim()) {
    return { valid: false, error: "Secret is required" };
  }

  const base32Result = validateBase32(secret);
  if (!base32Result.valid) {
    return { valid: false, error: `Secret validation failed: ${base32Result.error}` };
  }

  if (base32Result.warning) {
    return { valid: true, warning: `Key strength notice: ${base32Result.warning}` };
  }

  return { valid: true };
}

// ── OTP Parameter Validation ────────────────────────────────────────────────

export interface OTPParamsInput {
  type?: string;
  digits?: number;
  period?: number;
  algorithm?: string;
  counter?: number;
}

const VALID_PERIODS = [30, 60, 120];
const VALID_ALGORITHMS = ["SHA1", "SHA256", "SHA512"];

/**
 * Validate OTP parameters (type, digits, period, algorithm, counter).
 */
export function validateOTPParams({
  type = "TOTP",
  digits = 6,
  period = 30,
  algorithm = "SHA1",
  counter = 0,
}: OTPParamsInput = {}): ValidationResult {
  const normalizedType = type.toUpperCase();

  if (!["TOTP", "HOTP"].includes(normalizedType)) {
    return {
      valid: false,
      error: `Unsupported OTP type "${type}". Use TOTP or HOTP`,
    };
  }

  if (!(OTP_DIGIT_OPTIONS as readonly number[]).includes(digits)) {
    return {
      valid: false,
      error: `Invalid digit count ${digits}. Use 6 or 8`,
    };
  }

  if (normalizedType === "TOTP" && !VALID_PERIODS.includes(period)) {
    return {
      valid: false,
      error: `Invalid TOTP period ${period}s. Use 30, 60, or 120`,
    };
  }

  const normalizedAlg = algorithm.toUpperCase();
  if (!VALID_ALGORITHMS.includes(normalizedAlg)) {
    return {
      valid: false,
      error: `Unsupported algorithm "${algorithm}". Use SHA1, SHA256, or SHA512`,
    };
  }

  if (normalizedType === "HOTP" && (counter < 0 || !Number.isInteger(counter))) {
    return {
      valid: false,
      error: `Invalid HOTP counter "${counter}". Must be a non-negative integer`,
    };
  }

  return { valid: true };
}

// ── Secret Normalization ────────────────────────────────────────────────────

/**
 * Create a normalized ParsedSecret from raw input.
 * Generates a UUID if no existingId is provided.
 */
export function createSecretObject(
  data: {
    name: string;
    service?: string;
    secret: string;
    type?: string;
    digits?: number | string;
    period?: number | string;
    algorithm?: string;
    counter?: number | string;
  },
  existingId?: string | null
): ParsedSecret & { id: string; createdAt?: string } {
  const normalizedType = (data.type || "TOTP").toUpperCase();

  const obj: ParsedSecret & { id: string; createdAt?: string } = {
    id: existingId || crypto.randomUUID(),
    name: data.name.trim(),
    account: data.service ? data.service.trim() : "",
    secret: data.secret.toUpperCase().trim(),
    type: normalizedType === "HOTP" ? "hotp" : "totp",
    digits: parseInt(String(data.digits || 6), 10),
    period: parseInt(String(data.period || 30), 10),
    algorithm: (data.algorithm || "SHA-1").toUpperCase() as ParsedSecret["algorithm"],
    counter: normalizedType === "HOTP" ? parseInt(String(data.counter || 0), 10) : 0,
  };

  if (!existingId) {
    obj.createdAt = new Date().toISOString();
  }

  return obj;
}

// ── Sorting ─────────────────────────────────────────────────────────────────

/**
 * Sort secrets by name (case-insensitive).
 * Returns a new sorted array.
 */
export function sortSecretsByName<T extends { name: string }>(secrets: T[]): T[] {
  return [...secrets].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
}

// ── Duplicate Detection ─────────────────────────────────────────────────────

/**
 * Check if a secret with the same name + account + secret already exists.
 * @param excludeIndex - Index to skip (for updates)
 */
export function checkDuplicateSecret(
  secrets: { name: string; account?: string; secret?: string }[],
  name: string,
  account: string,
  secret: string = "",
  excludeIndex: number = -1
): boolean {
  const normalizedSecret = secret.replace(/\s+/g, "").toUpperCase();

  return secrets.some((s, index) => {
    if (index === excludeIndex) return false;
    const existingSecret = (s.secret || "").replace(/\s+/g, "").toUpperCase();
    return (
      s.name === name &&
      (s.account || "") === account &&
      existingSecret === normalizedSecret
    );
  });
}

// ── Batch Import Validation ─────────────────────────────────────────────────

/**
 * Validate a batch of secrets for import.
 */
export function validateBatchImport(
  secrets: unknown
): ValidationResult {
  if (!Array.isArray(secrets)) {
    return { valid: false, error: "Secrets must be an array" };
  }
  if (secrets.length === 0) {
    return { valid: false, error: "Secrets array is empty" };
  }
  if (secrets.length > BATCH_IMPORT_LIMIT) {
    return {
      valid: false,
      error: `Too many secrets (${secrets.length}). Maximum ${BATCH_IMPORT_LIMIT} per import`,
    };
  }
  return { valid: true };
}
