/**
 * Export formatter module — converts ParsedSecret[] to various output formats.
 * Migrated from 2fa project with TypeScript types.
 *
 * All formatters take ParsedSecret[] and return a string.
 */

import type { ParsedSecret, ExportFormat } from "./types";
import type { OtpAlgorithm } from "./constants";

// ── OTPAuth URI Builder ─────────────────────────────────────────────────────

/**
 * Build an otpauth:// URI from a ParsedSecret.
 */
export function toOtpauthUri(secret: ParsedSecret): string {
  const type = secret.type === "hotp" ? "hotp" : "totp";
  const label =
    secret.name + (secret.account ? ":" + secret.account : "");
  const params = new URLSearchParams({
    secret: secret.secret.toUpperCase(),
    issuer: secret.name,
    algorithm: denormalizeAlgorithm(secret.algorithm),
    digits: String(secret.digits || 6),
  });

  if (type === "totp") {
    params.set("period", String(secret.period || 30));
  } else {
    params.set("counter", String(secret.counter || 0));
  }

  return `otpauth://${type}/${encodeURIComponent(label)}?${params.toString()}`;
}

// ── Export Formats ──────────────────────────────────────────────────────────

/**
 * Export as otpauth:// URIs (one per line).
 * Compatible with: Ente Auth, WinAuth, generic import.
 */
export function exportAsOtpauthUris(secrets: ParsedSecret[]): string {
  return secrets.map(toOtpauthUri).join("\n");
}

/**
 * Export as Aegis JSON.
 */
export function exportAsAegis(secrets: ParsedSecret[]): string {
  const entries = secrets.map((s) => ({
    type: s.type === "hotp" ? "hotp" : "totp",
    uuid: crypto.randomUUID(),
    name: s.account || s.name,
    issuer: s.name,
    note: "",
    icon: null,
    info: {
      secret: s.secret.toUpperCase(),
      algo: denormalizeAlgorithm(s.algorithm),
      digits: s.digits || 6,
      period: s.period || 30,
      ...(s.type === "hotp" ? { counter: s.counter || 0 } : {}),
    },
  }));

  return JSON.stringify(
    { version: 1, header: { slots: null, params: null }, db: { version: 1, entries } },
    null,
    2
  );
}

/**
 * Export as 2FAS JSON.
 */
export function exportAs2FAS(secrets: ParsedSecret[]): string {
  const services = secrets.map((s) => ({
    name: s.name,
    secret: s.secret.toUpperCase(),
    otp: {
      tokenType: s.type === "hotp" ? "HOTP" : "TOTP",
      issuer: s.name,
      account: s.account || "",
      digits: s.digits || 6,
      period: s.period || 30,
      algorithm: denormalizeAlgorithm(s.algorithm),
      counter: s.counter || 0,
    },
    order: { position: 0 },
    icon: { selected: "Label", label: { text: s.name.substring(0, 2).toUpperCase(), backgroundColor: "Default" } },
  }));

  return JSON.stringify({ services, schemaVersion: 4, appVersionCode: 1 }, null, 2);
}

/**
 * Export as andOTP JSON.
 */
export function exportAsAndOTP(secrets: ParsedSecret[]): string {
  const entries = secrets.map((s) => ({
    secret: s.secret.toUpperCase(),
    issuer: s.name,
    label: s.account || s.name,
    digits: s.digits || 6,
    type: s.type === "hotp" ? "HOTP" : "TOTP",
    algorithm: denormalizeAlgorithm(s.algorithm),
    thumbnail: "Default",
    last_used: Date.now(),
    used_frequency: 0,
    period: s.period || 30,
    ...(s.type === "hotp" ? { counter: s.counter || 0 } : {}),
  }));

  return JSON.stringify(entries, null, 2);
}

/**
 * Export as Bitwarden JSON.
 */
export function exportAsBitwarden(secrets: ParsedSecret[]): string {
  const items = secrets.map((s) => ({
    id: crypto.randomUUID(),
    name: s.name,
    login: {
      username: s.account || "",
      totp: toOtpauthUri(s),
    },
    type: 1,
  }));

  return JSON.stringify({ items }, null, 2);
}

/**
 * Export as LastPass JSON.
 */
export function exportAsLastPass(secrets: ParsedSecret[]): string {
  const accounts = secrets.map((s) => ({
    issuerName: s.name,
    userName: s.account || "",
    secret: s.secret.toUpperCase(),
    digits: s.digits || 6,
    timeStep: s.period || 30,
    algorithm: denormalizeAlgorithm(s.algorithm),
  }));

  return JSON.stringify({ version: 1, accounts }, null, 2);
}

/**
 * Export as Proton Authenticator JSON.
 */
export function exportAsProton(secrets: ParsedSecret[]): string {
  const entries = secrets.map((s) => ({
    name: s.name,
    content: {
      uri: toOtpauthUri(s),
    },
  }));

  return JSON.stringify({ version: 1, entries }, null, 2);
}

/**
 * Export as Authenticator Pro JSON.
 */
export function exportAsAuthenticatorPro(secrets: ParsedSecret[]): string {
  const algMap: Record<string, number> = {
    "SHA-1": 0,
    "SHA-256": 1,
    "SHA-512": 2,
  };

  const Authenticators = secrets.map((s) => ({
    Issuer: s.name,
    Username: s.account || "",
    Secret: s.secret.toUpperCase(),
    Type: s.type === "hotp" ? 2 : 1,
    Digits: s.digits || 6,
    Period: s.period || 30,
    Algorithm: algMap[s.algorithm] ?? 0,
    Counter: s.counter || 0,
  }));

  return JSON.stringify({ Authenticators }, null, 2);
}

/**
 * Export as FreeOTP+ JSON.
 */
export function exportAsFreeOTPPlus(secrets: ParsedSecret[]): string {
  const tokens = secrets.map((s) => ({
    issuerExt: s.name,
    label: s.account || s.name,
    type: s.type === "hotp" ? "HOTP" : "TOTP",
    algo: denormalizeAlgorithm(s.algorithm),
    digits: s.digits || 6,
    period: s.period || 30,
    counter: s.counter || 0,
    // Store secret as Base32 string (simplified from Java byte arrays)
    secret: Array.from(base32ToBytes(s.secret)),
  }));

  return JSON.stringify({ tokens }, null, 2);
}

/**
 * Export as generic JSON.
 */
export function exportAsGenericJSON(secrets: ParsedSecret[]): string {
  return JSON.stringify({ secrets }, null, 2);
}

/**
 * Export as CSV.
 */
export function exportAsCSV(secrets: ParsedSecret[]): string {
  const headers = [
    "name",
    "account",
    "secret",
    "type",
    "digits",
    "period",
    "algorithm",
    "counter",
  ];

  const rows = secrets.map((s) =>
    [
      escapeCSV(s.name),
      escapeCSV(s.account),
      s.secret.toUpperCase(),
      s.type,
      String(s.digits || 6),
      String(s.period || 30),
      denormalizeAlgorithm(s.algorithm),
      String(s.counter || 0),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * Export as plain text (name + secret per line).
 */
export function exportAsText(secrets: ParsedSecret[]): string {
  return secrets
    .map(
      (s) =>
        `${s.name}${s.account ? " (" + s.account + ")" : ""}: ${s.secret.toUpperCase()}`
    )
    .join("\n");
}

// ── Unified Export ──────────────────────────────────────────────────────────

// Re-export ExportFormat from canonical source
export type { ExportFormat } from "./types";

/**
 * Export secrets in the specified format.
 */
export function exportSecrets(
  secrets: ParsedSecret[],
  format: ExportFormat
): string {
  switch (format) {
    case "otpauth-uri":
      return exportAsOtpauthUris(secrets);
    case "aegis":
      return exportAsAegis(secrets);
    case "2fas":
      return exportAs2FAS(secrets);
    case "andotp":
      return exportAsAndOTP(secrets);
    case "bitwarden":
      return exportAsBitwarden(secrets);
    case "lastpass":
      return exportAsLastPass(secrets);
    case "proton":
      return exportAsProton(secrets);
    case "authenticator-pro":
      return exportAsAuthenticatorPro(secrets);
    case "freeotp-plus":
      return exportAsFreeOTPPlus(secrets);
    case "generic-json":
      return exportAsGenericJSON(secrets);
    case "generic-csv":
      return exportAsCSV(secrets);
    case "generic-txt":
      return exportAsText(secrets);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Convert normalized algorithm (SHA-1) to compact form (SHA1).
 */
function denormalizeAlgorithm(alg: OtpAlgorithm | string): string {
  const map: Record<string, string> = {
    "SHA-1": "SHA1",
    "SHA-256": "SHA256",
    "SHA-512": "SHA512",
  };
  return map[alg] || "SHA1";
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32ToBytes(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/=/g, "");
  let bits = "";
  for (const c of clean) {
    const idx = BASE32_CHARS.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }

  return new Uint8Array(bytes);
}
