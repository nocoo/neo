/**
 * AES-GCM 256-bit encryption module.
 * Migrated from 2fa project — uses Web Crypto API exclusively.
 *
 * Encrypted format: `v1:<iv_base64>:<ciphertext_base64>`
 * - v1 prefix for future algorithm upgrades
 * - 96-bit random IV per encryption
 * - 128-bit authentication tag (GCM integrity)
 */

import { AES_KEY_LENGTH, AES_IV_LENGTH, ENCRYPTION_PREFIX } from "./constants";

// ── Base64 Helpers ──────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ── Key Management ──────────────────────────────────────────────────────────

/**
 * Import a base64-encoded key string as a CryptoKey.
 * @param keyBase64 - Base64-encoded 256-bit key
 * @throws {Error} if key is missing or has wrong length
 */
async function importKey(keyBase64: string): Promise<CryptoKey> {
  if (!keyBase64) {
    throw new Error("ENCRYPTION_KEY is required");
  }

  const keyData = base64ToArrayBuffer(keyBase64);

  if (keyData.length !== AES_KEY_LENGTH / 8) {
    throw new Error(
      `Invalid key length: expected ${AES_KEY_LENGTH / 8} bytes, got ${keyData.length}`
    );
  }

  return crypto.subtle.importKey(
    "raw",
    keyData.buffer as ArrayBuffer,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Encrypt data to the `v1:<iv>:<ciphertext>` format.
 * @param data - Any JSON-serializable value
 * @param keyBase64 - Base64-encoded 256-bit key
 * @returns Encrypted string in v1 format
 */
export async function encryptData<T>(data: T, keyBase64: string): Promise<string> {
  const key = await importKey(keyBase64);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));

  const iv = crypto.getRandomValues(new Uint8Array(AES_IV_LENGTH));

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    plaintext
  );

  const ivBase64 = arrayBufferToBase64(iv);
  const ciphertextBase64 = arrayBufferToBase64(ciphertext);

  return `${ENCRYPTION_PREFIX}${ivBase64}:${ciphertextBase64}`;
}

/**
 * Decrypt a `v1:<iv>:<ciphertext>` string back to the original data.
 * @param encrypted - Encrypted string in v1 format
 * @param keyBase64 - Base64-encoded 256-bit key
 * @returns Decrypted data
 * @throws {Error} if format is invalid, version unsupported, or decryption fails
 */
export async function decryptData<T>(encrypted: string, keyBase64: string): Promise<T> {
  const parts = encrypted.split(":");

  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted data format: expected "version:iv:ciphertext", got ${parts.length} parts`
    );
  }

  const [version, ivBase64, ciphertextBase64] = parts;

  if (version !== "v1") {
    throw new Error(`Unsupported encryption version: ${version}`);
  }

  const key = await importKey(keyBase64);
  const iv = base64ToArrayBuffer(ivBase64);
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);

  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, tagLength: 128 },
    key,
    ciphertext.buffer as ArrayBuffer
  );

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintext)) as T;
}

/**
 * Check whether a value looks like encrypted data (v1 format).
 */
export function isEncrypted(data: unknown): boolean {
  return typeof data === "string" && data.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Generate a new random 256-bit encryption key as a base64 string.
 */
export async function generateEncryptionKey(): Promise<string> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(AES_KEY_LENGTH / 8));
  return arrayBufferToBase64(keyBytes);
}
