/**
 * OTP (One-Time Password) generation module.
 * Implements TOTP (RFC 6238) and HOTP (RFC 4226) algorithms.
 * Pure TypeScript, zero React dependency. Uses Web Crypto API.
 *
 * Fixes P1: Uses full 64-bit counter write (high + low 32-bit).
 */

// ── Base32 Codec ─────────────────────────────────────────────────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decode a Base32-encoded string to a Uint8Array.
 * @throws {Error} on invalid Base32 characters
 */
export function base32toByteArray(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=/g, "");

  for (const c of clean) {
    if (BASE32_CHARS.indexOf(c) === -1) {
      throw new Error("Invalid Base32 character: " + c);
    }
  }

  const bits = clean
    .split("")
    .map((char) => {
      const index = BASE32_CHARS.indexOf(char);
      return index.toString(2).padStart(5, "0");
    })
    .join("");

  const bytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    const byte = bits.slice(i, i + 8);
    if (byte.length === 8) {
      bytes.push(parseInt(byte, 2));
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Encode a Uint8Array to a Base32 string (no padding).
 */
export function byteArrayToBase32(bytes: Uint8Array): string {
  let bits = "";
  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  let result = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (chunk.length === 5) {
      result += BASE32_CHARS[parseInt(chunk, 2)];
    }
  }

  return result;
}

// ── Hash Algorithm Mapping ───────────────────────────────────────────────────

/**
 * Map various algorithm name formats to Web Crypto API names.
 */
export function getHashAlgorithm(algorithm: string): string {
  const algMap: Record<string, string> = {
    SHA1: "SHA-1",
    "SHA-1": "SHA-1",
    SHA256: "SHA-256",
    "SHA-256": "SHA-256",
    SHA512: "SHA-512",
    "SHA-512": "SHA-512",
  };

  return algMap[algorithm.toUpperCase()] || "SHA-1";
}

// ── OTP Generation ───────────────────────────────────────────────────────────

export interface OTPOptions {
  digits?: number;
  period?: number;
  algorithm?: string;
  type?: string;
  counter?: number;
}

/**
 * Generate an OTP code (supports TOTP and HOTP).
 *
 * Fix P1: Uses full 64-bit counter write — splits into high 32-bit and
 * low 32-bit values written in big-endian order.
 *
 * @param secret - Base32-encoded secret key
 * @param loadTime - Unix timestamp in seconds (for TOTP) or ignored for HOTP
 * @param options - OTP parameters
 * @returns OTP code string (zero-padded)
 */
export async function generateOTP(
  secret: string,
  loadTime: number,
  options: OTPOptions = {}
): Promise<string> {
  const digits = options.digits || 6;
  const period = options.period || 30;
  const algorithm = options.algorithm || "SHA1";
  const type = options.type || "TOTP";

  let counter: number;

  switch (type.toUpperCase()) {
    case "HOTP":
      counter = options.counter || 0;
      break;
    case "TOTP":
    default: {
      const timeForCalculation = loadTime || Math.floor(Date.now() / 1000);
      counter = Math.floor(timeForCalculation / period);
      break;
    }
  }

  // Convert counter to 8-byte big-endian array (full 64-bit write — fixes P1)
  const counterBytes = new ArrayBuffer(8);
  const counterView = new DataView(counterBytes);
  const highBits = Math.floor(counter / 0x100000000);
  const lowBits = counter >>> 0;
  counterView.setUint32(0, highBits, false);
  counterView.setUint32(4, lowBits, false);

  const secretBytes = base32toByteArray(secret);
  const hashAlgorithm = getHashAlgorithm(algorithm);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes.buffer as ArrayBuffer,
    { name: "HMAC", hash: { name: hashAlgorithm } },
    false,
    ["sign"]
  );

  const hmacBuffer = await crypto.subtle.sign("HMAC", key, counterBytes);
  const hmacArray = Array.from(new Uint8Array(hmacBuffer));

  const lastByte = hmacArray[hmacArray.length - 1];
  if (lastByte === undefined) throw new Error("HMAC produced empty output");
  const offset = lastByte & 0xf;
  const truncatedHash = hmacArray.slice(offset, offset + 4);
  const otpValue =
    new DataView(new Uint8Array(truncatedHash).buffer).getUint32(0) &
    0x7fffffff;

  const modulus = Math.pow(10, digits);
  return (otpValue % modulus).toString().padStart(digits, "0");
}

/**
 * Client-side OTP generation (for preview).
 * Returns placeholder on failure instead of throwing.
 *
 * Note: This also uses 64-bit counter write for consistency.
 */
export async function generateTOTP(
  secret: string,
  counter: number,
  options: OTPOptions = {}
): Promise<string> {
  try {
    const digits = options.digits || 6;
    const algorithm = options.algorithm || "SHA1";

    const key = base32toByteArray(secret);

    // Full 64-bit counter write (fixes P1 inconsistency with generateOTP)
    const counterBytes = new ArrayBuffer(8);
    const counterView = new DataView(counterBytes);
    const highBits = Math.floor(counter / 0x100000000);
    const lowBits = counter >>> 0;
    counterView.setUint32(0, highBits, false);
    counterView.setUint32(4, lowBits, false);

    const hashAlgorithm = getHashAlgorithm(algorithm);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key.buffer as ArrayBuffer,
      { name: "HMAC", hash: hashAlgorithm },
      false,
      ["sign"]
    );

    const signature = await crypto.subtle.sign("HMAC", cryptoKey, counterBytes);
    const hmac = new Uint8Array(signature);

    const lastByte = hmac[hmac.length - 1];
    if (lastByte === undefined) throw new Error("HMAC produced empty output");
    const offset = lastByte & 0x0f;

    const b0 = hmac[offset] ?? 0;
    const b1 = hmac[offset + 1] ?? 0;
    const b2 = hmac[offset + 2] ?? 0;
    const b3 = hmac[offset + 3] ?? 0;
    const binary =
      ((b0 & 0x7f) << 24) |
      ((b1 & 0xff) << 16) |
      ((b2 & 0xff) << 8) |
      (b3 & 0xff);

    const modulus = Math.pow(10, digits);
    const otp = binary % modulus;
    return otp.toString().padStart(digits, "0");
  } catch {
    // Return placeholder on failure (client preview)
    return "-".repeat(options.digits || 6);
  }
}

/**
 * Generate an OTPAuth URL for QR code generation.
 */
export function generateOTPAuthURL(
  serviceName: string,
  accountName: string,
  secret: string,
  options: OTPOptions = {}
): string {
  const digits = options.digits || 6;
  const period = options.period || 30;
  const algorithm = options.algorithm || "SHA1";
  const type = options.type || "TOTP";
  const counter = options.counter || 0;

  const label = serviceName + (accountName ? ":" + accountName : "");

  let scheme: string;
  let params: URLSearchParams;

  switch (type.toUpperCase()) {
    case "HOTP":
      scheme = "hotp";
      params = new URLSearchParams({
        secret: secret.toUpperCase(),
        issuer: serviceName,
        algorithm: algorithm.toUpperCase(),
        digits: digits.toString(),
        counter: counter.toString(),
      });
      break;
    case "TOTP":
    default:
      scheme = "totp";
      params = new URLSearchParams({
        secret: secret.toUpperCase(),
        issuer: serviceName,
        algorithm: algorithm.toUpperCase(),
        digits: digits.toString(),
        period: period.toString(),
      });
      break;
  }

  return `otpauth://${scheme}/${encodeURIComponent(label)}?${params.toString()}`;
}
