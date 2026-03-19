/**
 * Cryptographic utilities for the worker.
 * Extracted to avoid circular dependencies (fix P4).
 */

/**
 * Compute SHA-256 hex hash of arbitrary string data.
 * Uses Web Crypto API (available in Workers runtime).
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Encrypt plaintext using AES-GCM 256-bit.
 * Returns format: `v1:<iv_base64>:<ciphertext_base64>`
 *
 * @param plaintext - The string to encrypt
 * @param base64Key - Base64-encoded 32-byte key
 */
export async function encryptAesGcm(
  plaintext: string,
  base64Key: string
): Promise<string> {
  const keyBytes = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encoded
  );

  const ivB64 = btoa(String.fromCharCode(...iv));
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  return `v1:${ivB64}:${ctB64}`;
}

/**
 * Detect if data is encrypted (v1: format).
 */
export function isEncrypted(data: string): boolean {
  return data.startsWith("v1:");
}
