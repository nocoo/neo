/**
 * Encrypted backup archive model.
 *
 * Creates and opens encrypted ZIP archives for backup/restore.
 * Archive format:
 *   neo-backup-YYYY-MM-DD.zip
 *   ├── manifest.json        (plaintext metadata)
 *   └── backup.json.enc      (AES-GCM encrypted BackupData v2 JSON)
 *
 * Pure functions — no DB, no side effects.
 */

import { zipSync, unzipSync } from "fflate";
import { encryptData, decryptData } from "./encryption";
import type { ParsedSecret } from "./types";

// ── Constants ────────────────────────────────────────────────────────────────

const MANIFEST_FILENAME = "manifest.json";
const PAYLOAD_FILENAME = "backup.json.enc";
const ARCHIVE_FORMAT = "neo-encrypted-backup";
const BACKUP_DATA_VERSION = 2;

/** Maximum uploaded ZIP size: 10 MB */
export const MAX_ARCHIVE_UPLOAD_BYTES = 10 * 1024 * 1024;

/** Maximum number of entries inside the ZIP (manifest + payload = 2) */
const MAX_ZIP_ENTRIES = 10;

/** Maximum decrypted payload size: 50 MB (catches zip bomb after decrypt) */
const MAX_PAYLOAD_BYTES = 50 * 1024 * 1024;

/** Maximum number of secrets in a single archive */
export const MAX_ARCHIVE_SECRETS = 10_000;

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupManifest {
  version: number;
  format: string;
  createdAt: string;
  secretCount: number;
  encryption: {
    algorithm: string;
    ivEncoding: string;
    tagLength: number;
  };
}

export interface BackupDataV2 {
  version: 2;
  createdAt: string;
  secretCount: number;
  hash: string;
  secrets: ParsedSecret[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a string to a plain Uint8Array.
 *
 * fflate uses `instanceof Uint8Array` internally, which fails in jsdom
 * where TextEncoder produces a different Uint8Array realm. Using
 * `Uint8Array.from()` ensures cross-realm compatibility.
 */
function toBytes(str: string): Uint8Array {
  return Uint8Array.from(new TextEncoder().encode(str));
}

/**
 * Decode a Uint8Array to a string.
 */
function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Compute SHA-256 hex hash for backup integrity.
 * Deterministic: sorts secrets by name+account before hashing.
 */
async function computeSha256Hash(secrets: ParsedSecret[]): Promise<string> {
  const normalized = secrets
    .map(
      (s) =>
        `${s.name}|${s.account}|${s.secret}|${s.type}|${s.digits}|${s.period}|${s.algorithm}|${s.counter}`,
    )
    .sort()
    .join("\n");

  const encoded = new TextEncoder().encode(normalized);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);

  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Create an encrypted ZIP archive from secrets.
 *
 * Internally assembles BackupData v2 JSON, encrypts it with AES-GCM,
 * and packages it into a ZIP with a plaintext manifest.
 *
 * @param secrets - Secrets to back up
 * @param keyBase64 - Base64-encoded AES-256 encryption key
 * @returns ZIP file as Uint8Array
 */
export async function createEncryptedZip(
  secrets: ParsedSecret[],
  keyBase64: string,
): Promise<Uint8Array> {
  const now = new Date().toISOString();
  const hash = await computeSha256Hash(secrets);

  // Assemble BackupData v2 payload
  const payload: BackupDataV2 = {
    version: BACKUP_DATA_VERSION,
    createdAt: now,
    secretCount: secrets.length,
    hash,
    secrets,
  };

  // Encrypt the payload
  const encrypted = await encryptData(payload, keyBase64);
  const encryptedBytes = toBytes(encrypted);

  // Build manifest (plaintext metadata — no secrets)
  const manifest: BackupManifest = {
    version: BACKUP_DATA_VERSION,
    format: ARCHIVE_FORMAT,
    createdAt: now,
    secretCount: secrets.length,
    encryption: {
      algorithm: "AES-GCM-256",
      ivEncoding: "base64",
      tagLength: 128,
    },
  };
  const manifestBytes = toBytes(JSON.stringify(manifest, null, 2));

  // Create ZIP
  return zipSync({
    [MANIFEST_FILENAME]: manifestBytes,
    [PAYLOAD_FILENAME]: encryptedBytes,
  });
}

/**
 * Open an encrypted ZIP archive and restore secrets.
 *
 * @param zipBytes - ZIP file as Uint8Array
 * @param keyBase64 - Base64-encoded AES-256 encryption key
 * @returns Parsed secrets from the archive
 * @throws {Error} if ZIP structure is invalid, manifest is malformed, or decryption fails
 */
export async function openEncryptedZip(
  zipBytes: Uint8Array,
  keyBase64: string,
): Promise<ParsedSecret[]> {
  // Guard: reject oversized uploads before decompression
  if (zipBytes.byteLength > MAX_ARCHIVE_UPLOAD_BYTES) {
    throw new Error(
      `Archive too large: ${zipBytes.byteLength} bytes exceeds ${MAX_ARCHIVE_UPLOAD_BYTES} byte limit`,
    );
  }

  // Extract ZIP contents — Uint8Array.from() for cross-realm compat
  const files = unzipSync(Uint8Array.from(zipBytes));

  // Guard: limit number of entries to catch crafted ZIPs
  const entryNames = Object.keys(files);
  if (entryNames.length > MAX_ZIP_ENTRIES) {
    throw new Error(
      `Archive has too many entries: ${entryNames.length} exceeds ${MAX_ZIP_ENTRIES} limit`,
    );
  }

  // Guard: limit total decompressed size
  let totalBytes = 0;
  for (const name of entryNames) {
    totalBytes += files[name].byteLength;
    if (totalBytes > MAX_PAYLOAD_BYTES) {
      throw new Error(
        `Decompressed archive too large: exceeds ${MAX_PAYLOAD_BYTES} byte limit`,
      );
    }
  }

  // Validate manifest exists
  const manifestBytes = files[MANIFEST_FILENAME];
  if (!manifestBytes) {
    throw new Error(
      `Invalid archive: missing ${MANIFEST_FILENAME}`,
    );
  }

  // Parse and validate manifest
  const manifest = JSON.parse(
    fromBytes(manifestBytes),
  ) as BackupManifest;
  validateManifest(manifest);

  // Validate encrypted payload exists
  const payloadBytes = files[PAYLOAD_FILENAME];
  if (!payloadBytes) {
    throw new Error(
      `Invalid archive: missing ${PAYLOAD_FILENAME}`,
    );
  }

  // Decrypt payload
  const encryptedStr = fromBytes(payloadBytes);
  const payload = await decryptData<BackupDataV2>(encryptedStr, keyBase64);

  // Validate payload structure
  if (!payload || !Array.isArray(payload.secrets)) {
    throw new Error("Invalid archive: decrypted payload has no secrets array");
  }

  // Guard: limit number of secrets
  if (payload.secrets.length > MAX_ARCHIVE_SECRETS) {
    throw new Error(
      `Archive contains too many secrets: ${payload.secrets.length} exceeds ${MAX_ARCHIVE_SECRETS} limit`,
    );
  }

  return payload.secrets;
}

/**
 * Validate a backup manifest.
 * @throws {Error} if the manifest is invalid
 */
export function validateManifest(manifest: BackupManifest): void {
  if (!manifest) {
    throw new Error("Invalid manifest: null or undefined");
  }

  if (manifest.format !== ARCHIVE_FORMAT) {
    throw new Error(
      `Invalid manifest: unexpected format "${manifest.format}", expected "${ARCHIVE_FORMAT}"`,
    );
  }

  if (manifest.version !== BACKUP_DATA_VERSION) {
    throw new Error(
      `Invalid manifest: unsupported version ${manifest.version}, expected ${BACKUP_DATA_VERSION}`,
    );
  }

  if (typeof manifest.secretCount !== "number" || manifest.secretCount < 0) {
    throw new Error(
      `Invalid manifest: secretCount must be a non-negative number`,
    );
  }

  if (!manifest.encryption || manifest.encryption.algorithm !== "AES-GCM-256") {
    throw new Error(
      `Invalid manifest: unsupported encryption algorithm`,
    );
  }
}

/**
 * Generate a filename for a backup archive.
 * Format: neo-backup-YYYY-MM-DD.zip
 */
export function generateArchiveFilename(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  return `neo-backup-${y}-${m}-${d}.zip`;
}
