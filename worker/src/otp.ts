/**
 * Quick OTP generation endpoint.
 * Public API — no authentication required.
 *
 * GET /otp/:secret?type=TOTP&digits=6&period=30&algorithm=SHA1&format=json
 */

import type { Env } from "./types";
import { createJsonResponse, createTextResponse } from "./utils/response";

// ── Base32 Codec (inline to avoid cross-package dependency) ─────────────────

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32toByteArray(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=/g, "");
  for (const c of clean) {
    if (BASE32_CHARS.indexOf(c) === -1) {
      throw new Error("Invalid Base32 character: " + c);
    }
  }

  const bits = clean
    .split("")
    .map((char) => BASE32_CHARS.indexOf(char).toString(2).padStart(5, "0"))
    .join("");

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return new Uint8Array(bytes);
}

// ── Hash algorithm mapping ──────────────────────────────────────────────────

function getHashAlgorithm(alg: string): string {
  const map: Record<string, string> = {
    SHA1: "SHA-1",
    "SHA-1": "SHA-1",
    SHA256: "SHA-256",
    "SHA-256": "SHA-256",
    SHA512: "SHA-512",
    "SHA-512": "SHA-512",
  };
  return map[alg.toUpperCase()] || "SHA-1";
}

// ── OTP Generation (inline) ────────────────────────────────────────────────

async function generateOTP(
  secret: string,
  time: number,
  options: {
    digits?: number;
    period?: number;
    algorithm?: string;
    type?: string;
    counter?: number;
  }
): Promise<string> {
  const digits = options.digits || 6;
  const period = options.period || 30;
  const algorithm = options.algorithm || "SHA1";
  const type = (options.type || "TOTP").toUpperCase();

  let counter: number;
  if (type === "HOTP") {
    counter = options.counter || 0;
  } else {
    counter = Math.floor((time || Math.floor(Date.now() / 1000)) / period);
  }

  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const secretBytes = base32toByteArray(secret);
  const hashAlg = getHashAlgorithm(algorithm);

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: { name: hashAlg } },
    false,
    ["sign"]
  );

  const hmacBuffer = await crypto.subtle.sign("HMAC", key, counterBytes);
  const hmac = Array.from(new Uint8Array(hmacBuffer));

  const offset = hmac[hmac.length - 1] & 0xf;
  const otpValue =
    new DataView(new Uint8Array(hmac.slice(offset, offset + 4)).buffer).getUint32(0) &
    0x7fffffff;

  return (otpValue % Math.pow(10, digits)).toString().padStart(digits, "0");
}

// ── Validation ──────────────────────────────────────────────────────────────

function isValidBase32(secret: string): boolean {
  const clean = secret.toUpperCase().replace(/[= ]/g, "");
  return clean.length >= 8 && /^[A-Z2-7]+$/.test(clean);
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function handleOtp(
  secret: string,
  params: URLSearchParams,
  _env: Env
): Promise<Response> {
  if (!secret || !isValidBase32(secret)) {
    return createJsonResponse(
      { error: "Invalid Base32 secret", hint: "GET /otp/YOUR_SECRET?format=json" },
      400
    );
  }

  const type = (params.get("type") || "TOTP").toUpperCase();
  const digits = parseInt(params.get("digits") || "6", 10);
  const period = parseInt(params.get("period") || "30", 10);
  const algorithm = (params.get("algorithm") || "SHA1").toUpperCase();
  const counter = parseInt(params.get("counter") || "0", 10);
  const format = params.get("format") || "json";

  // Validate parameters
  if (!["TOTP", "HOTP"].includes(type)) {
    return createJsonResponse({ error: "Invalid type. Use TOTP or HOTP" }, 400);
  }
  if (![6, 8].includes(digits)) {
    return createJsonResponse({ error: "Invalid digits. Use 6 or 8" }, 400);
  }
  if (![30, 60, 120].includes(period)) {
    return createJsonResponse({ error: "Invalid period. Use 30, 60, or 120" }, 400);
  }
  if (!["SHA1", "SHA256", "SHA512"].includes(algorithm)) {
    return createJsonResponse({ error: "Invalid algorithm. Use SHA1, SHA256, or SHA512" }, 400);
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const otp = await generateOTP(secret, now, {
      type,
      digits,
      period,
      algorithm,
      counter,
    });

    const remaining = period - (now % period);

    if (format === "text") {
      return createTextResponse(otp);
    }

    return createJsonResponse({
      otp,
      type,
      digits,
      period,
      algorithm,
      remaining,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    return createJsonResponse(
      { error: "OTP generation failed", detail: err instanceof Error ? err.message : "Unknown error" },
      500
    );
  }
}
