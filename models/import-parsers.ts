/**
 * Import parser infrastructure and parsers for all supported formats.
 * Migrated from 2fa project — rewritten as proper TypeScript modules.
 *
 * All parsers output ParsedSecret[]. The universal intermediate format
 * is the otpauth:// URI (RFC 6238 / RFC 4226).
 */

import type { ParsedSecret, ImportFormat } from "./types";
import type { OtpType, OtpAlgorithm } from "./constants";

// ── OTPAuth URI Parser (core) ───────────────────────────────────────────────

/**
 * Parse an otpauth:// URI into a ParsedSecret.
 * This is the lingua franca of all import/export operations.
 *
 * Format: otpauth://totp/Label?secret=BASE32&issuer=Name&digits=6&period=30&algorithm=SHA1
 */
export function parseOtpauthUri(uri: string): ParsedSecret | null {
  try {
    const trimmed = uri.trim();
    if (!trimmed.startsWith("otpauth://")) return null;

    const url = new URL(trimmed);
    const type = url.hostname.toLowerCase() as OtpType;
    if (type !== "totp" && type !== "hotp") return null;

    const secret = url.searchParams.get("secret")?.toUpperCase() || "";
    if (!secret) return null;

    // Label is /Issuer:Account or /Account
    const path = decodeURIComponent(url.pathname.slice(1));
    let name = url.searchParams.get("issuer") || "";
    let account = "";

    if (path.includes(":")) {
      const colonIdx = path.indexOf(":");
      if (!name) name = path.slice(0, colonIdx);
      account = path.slice(colonIdx + 1);
    } else {
      if (!name) name = path;
    }

    const digits = parseInt(url.searchParams.get("digits") || "6", 10);
    const period = parseInt(url.searchParams.get("period") || "30", 10);
    const counter = parseInt(url.searchParams.get("counter") || "0", 10);
    const algorithmRaw = (url.searchParams.get("algorithm") || "SHA1").toUpperCase();

    // Normalize algorithm names
    let algorithm: OtpAlgorithm;
    switch (algorithmRaw) {
      case "SHA256":
      case "SHA-256":
        algorithm = "SHA-256";
        break;
      case "SHA512":
      case "SHA-512":
        algorithm = "SHA-512";
        break;
      default:
        algorithm = "SHA-1";
    }

    return {
      name: name || "Unknown",
      account,
      secret,
      type,
      digits: [6, 7, 8].includes(digits) ? digits : 6,
      period: period > 0 ? period : 30,
      algorithm,
      counter: type === "hotp" ? counter : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Parse multiple otpauth:// URIs from text (one per line).
 */
export function parseOtpauthUris(text: string): ParsedSecret[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("otpauth://"))
    .map(parseOtpauthUri)
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Aegis (Android) ─────────────────────────────────────────────────────────

interface AegisEntry {
  type?: string;
  name?: string;
  issuer?: string;
  info?: {
    secret?: string;
    digits?: number;
    period?: number;
    algo?: string;
    counter?: number;
  };
}

export function parseAegis(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const entries: AegisEntry[] = data?.db?.entries || [];

  return entries
    .filter((e) => e.type === "totp" || e.type === "hotp")
    .map((e): ParsedSecret | null => {
      const secret = e.info?.secret?.toUpperCase();
      if (!secret) return null;

      return {
        name: e.issuer || e.name || "Unknown",
        account: e.name || "",
        secret,
        type: (e.type || "totp") as OtpType,
        digits: e.info?.digits || 6,
        period: e.info?.period || 30,
        algorithm: normalizeAlgorithm(e.info?.algo),
        counter: e.info?.counter || 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── 2FAS ────────────────────────────────────────────────────────────────────

interface TwoFasService {
  otp?: {
    tokenType?: string;
    account?: string;
    issuer?: string;
    digits?: number;
    period?: number;
    algorithm?: string;
    counter?: number;
    source?: string;
    link?: string;
  };
  secret?: string;
  name?: string;
}

export function parse2FAS(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const services: TwoFasService[] = data?.services || [];

  return services
    .map((s): ParsedSecret | null => {
      const secret = (s.secret || "").toUpperCase();
      if (!secret) return null;

      return {
        name: s.otp?.issuer || s.name || "Unknown",
        account: s.otp?.account || "",
        secret,
        type: ((s.otp?.tokenType || "TOTP").toLowerCase()) as OtpType,
        digits: s.otp?.digits || 6,
        period: s.otp?.period || 30,
        algorithm: normalizeAlgorithm(s.otp?.algorithm),
        counter: s.otp?.counter || 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Bitwarden ───────────────────────────────────────────────────────────────

interface BitwardenItem {
  name?: string;
  login?: {
    username?: string;
    totp?: string;
  };
}

export function parseBitwarden(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const items: BitwardenItem[] = data?.items || [];

  return items
    .filter((item) => item.login?.totp)
    .map((item): ParsedSecret | null => {
      const totp = item.login?.totp;
      if (!totp) return null;

      // Bitwarden stores either otpauth:// URIs or plain secrets
      if (totp.startsWith("otpauth://")) {
        return parseOtpauthUri(totp);
      }

      return {
        name: item.name || "Unknown",
        account: item.login?.username || "",
        secret: totp.toUpperCase().replace(/\s/g, ""),
        type: "totp",
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
        counter: 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── andOTP ──────────────────────────────────────────────────────────────────

interface AndOtpEntry {
  secret?: string;
  issuer?: string;
  label?: string;
  type?: string;
  digits?: number;
  period?: number;
  algorithm?: string;
  counter?: number;
}

export function parseAndOTP(json: string): ParsedSecret[] {
  const entries: AndOtpEntry[] = JSON.parse(json);

  if (!Array.isArray(entries)) return [];

  return entries
    .map((e): ParsedSecret | null => {
      const secret = (e.secret || "").toUpperCase();
      if (!secret) return null;

      return {
        name: e.issuer || e.label || "Unknown",
        account: e.label || "",
        secret,
        type: ((e.type || "TOTP").toLowerCase()) as OtpType,
        digits: e.digits || 6,
        period: e.period || 30,
        algorithm: normalizeAlgorithm(e.algorithm),
        counter: e.counter || 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── LastPass Authenticator ──────────────────────────────────────────────────

interface LastPassAccount {
  issuerName?: string;
  userName?: string;
  secret?: string;
  digits?: number;
  timeStep?: number;
  algorithm?: string;
}

export function parseLastPass(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const accounts: LastPassAccount[] = data?.accounts || [];

  return accounts
    .map((a): ParsedSecret | null => {
      const secret = (a.secret || "").toUpperCase();
      if (!secret) return null;

      return {
        name: a.issuerName || "Unknown",
        account: a.userName || "",
        secret,
        type: "totp",
        digits: a.digits || 6,
        period: a.timeStep || 30,
        algorithm: normalizeAlgorithm(a.algorithm),
        counter: 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Proton Authenticator ────────────────────────────────────────────────────

interface ProtonEntry {
  content?: {
    uri?: string;
  };
  name?: string;
}

export function parseProton(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const entries: ProtonEntry[] = data?.entries || [];

  return entries
    .map((e): ParsedSecret | null => {
      if (e.content?.uri) {
        return parseOtpauthUri(e.content.uri);
      }
      return null;
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Authenticator Pro ───────────────────────────────────────────────────────

interface AuthProEntry {
  Issuer?: string;
  Username?: string;
  Secret?: string;
  Type?: number;
  Digits?: number;
  Period?: number;
  Algorithm?: number;
  Counter?: number;
}

export function parseAuthenticatorPro(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const entries: AuthProEntry[] = data?.Authenticators || [];

  return entries
    .map((e): ParsedSecret | null => {
      const secret = (e.Secret || "").toUpperCase();
      if (!secret) return null;

      const typeMap: Record<number, OtpType> = { 1: "totp", 2: "hotp" };
      const algMap: Record<number, OtpAlgorithm> = {
        0: "SHA-1",
        1: "SHA-256",
        2: "SHA-512",
      };

      return {
        name: e.Issuer || "Unknown",
        account: e.Username || "",
        secret,
        type: typeMap[e.Type || 1] || "totp",
        digits: e.Digits || 6,
        period: e.Period || 30,
        algorithm: algMap[e.Algorithm || 0] || "SHA-1",
        counter: e.Counter || 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── FreeOTP+ ────────────────────────────────────────────────────────────────

interface FreeOTPPlusToken {
  issuerExt?: string;
  label?: string;
  secret?: number[];
  type?: string;
  digits?: number;
  period?: number;
  algo?: string;
  counter?: number;
}

export function parseFreeOTPPlus(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const tokens: FreeOTPPlusToken[] = data?.tokens || [];

  return tokens
    .map((t): ParsedSecret | null => {
      if (!t.secret || !Array.isArray(t.secret)) return null;

      // Convert signed byte array to base32
      const bytes = new Uint8Array(t.secret.map((b) => (b < 0 ? b + 256 : b)));
      const secret = bytesToBase32(bytes);
      if (!secret) return null;

      return {
        name: t.issuerExt || t.label || "Unknown",
        account: t.label || "",
        secret,
        type: ((t.type || "TOTP").toLowerCase()) as OtpType,
        digits: t.digits || 6,
        period: t.period || 30,
        algorithm: normalizeAlgorithm(t.algo),
        counter: t.counter || 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Google Authenticator (otpauth-migration) ────────────────────────────────

/**
 * Google Authenticator exports as otpauth-migration:// URIs.
 * The payload is a protocol buffer wrapped in base64.
 * For simplicity, we support the plain otpauth:// format that
 * Google Authenticator can also export.
 */
export function parseGoogleAuthenticator(text: string): ParsedSecret[] {
  return parseOtpauthUris(text);
}

// ── Ente Auth ───────────────────────────────────────────────────────────────

/**
 * Ente Auth exports as plain text with otpauth:// URIs.
 */
export function parseEnteAuth(text: string): ParsedSecret[] {
  return parseOtpauthUris(text);
}

// ── WinAuth ─────────────────────────────────────────────────────────────────

/**
 * WinAuth exports as otpauth:// URIs.
 */
export function parseWinAuth(text: string): ParsedSecret[] {
  return parseOtpauthUris(text);
}

// ── Raivo ───────────────────────────────────────────────────────────────────

interface RaivoEntry {
  issuer?: string;
  account?: string;
  secret?: string;
  algorithm?: string;
  digits?: number;
  kind?: string;
  timer?: number;
  counter?: number;
}

export function parseRaivo(json: string): ParsedSecret[] {
  const entries: RaivoEntry[] = JSON.parse(json);
  if (!Array.isArray(entries)) return [];

  return entries
    .map((e): ParsedSecret | null => {
      const secret = (e.secret || "").toUpperCase();
      if (!secret) return null;

      return {
        name: e.issuer || "Unknown",
        account: e.account || "",
        secret,
        type: ((e.kind || "TOTP").toLowerCase()) as OtpType,
        digits: e.digits || 6,
        period: e.timer || 30,
        algorithm: normalizeAlgorithm(e.algorithm),
        counter: e.counter || 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Step Two (macOS/iOS) ────────────────────────────────────────────────────

/**
 * Parse Step Two iCloud Data Report (RTF format).
 *
 * Step Two exports an RTF document with structured account entries.
 * Each entry has: Account Name, Email Address or Username, Secret Key,
 * Hash Algorithm, Period, Digits, and Color.
 * Fields are separated by Unicode Line Separator (U+2028).
 */
export function parseStepTwo(rtf: string): ParsedSecret[] {
  const text = stripRtf(rtf);

  // Split into account blocks — each block starts with "Account Name:"
  const blocks = text.split(/(?=Account Name:)/i).filter((b) => b.includes("Secret Key:"));

  return blocks
    .map((block): ParsedSecret | null => {
      const get = (label: string): string => {
        const re = new RegExp(`${label}:[^\\S\\n]*([^\\n]*)`, "i");
        const match = block.match(re);
        return match?.[1]?.trim() || "";
      };

      const secret = get("Secret Key").toUpperCase().replace(/\s/g, "");
      if (!secret) return null;

      const algorithmRaw = get("Hash Algorithm");
      const periodRaw = get("Period").replace(/\s*seconds?/i, "");
      const digitsRaw = get("Digits");

      return {
        name: get("Account Name") || "Unknown",
        account: get("Email Address or Username"),
        secret,
        type: "totp",
        digits: parseInt(digitsRaw, 10) || 6,
        period: parseInt(periodRaw, 10) || 30,
        algorithm: normalizeAlgorithm(algorithmRaw),
        counter: 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

/**
 * Strip RTF control words and extract plain text.
 * Handles unicode escapes (\uN), curly braces, and common control words.
 */
function stripRtf(rtf: string): string {
  let text = rtf;

  // Remove RTF header groups like {\fonttbl...}, {\colortbl...}, {\*\expandedcolortbl...}
  text = text.replace(/\{\\(?:\*\\)?(?:fonttbl|colortbl|expandedcolortbl|stylesheet|info)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, "");

  // Convert Unicode escapes \uN to actual characters (skip the trailing replacement char)
  text = text.replace(/\\uc0\s*/g, "");
  text = text.replace(/\\u(\d+)(?:\s|\\[A-Za-z]+\s*|[^A-Za-z])?/g, (_match, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });

  // Remove remaining RTF control words (e.g., \f0, \b, \fs28, \pard..., \par)
  // \par and \line become newlines
  text = text.replace(/\\par\b\s*/g, "\n");
  text = text.replace(/\\line\b\s*/g, "\n");
  text = text.replace(/\\\\/g, "\\");
  text = text.replace(
    new RegExp("\\\\'" + "([0-9a-fA-F]{2})", "g"),
    (_m, hex) => String.fromCharCode(parseInt(hex as string, 16))
  );
  text = text.replace(/\\[A-Za-z]+\d*\s?/g, "");

  // Remove curly braces
  text = text.replace(/[{}]/g, "");

  // Normalize Unicode Line Separator (U+2028) and other separators to newline
  text = text.replace(/[\u2028\u2029\u2008\u2009\u200A\u202F\u205F\u8239]/g, "\n");
  // Also handle \u8232 as literal text leftover (decimal for U+2028)
  text = text.replace(/\u2028/g, "\n");

  // Clean up multiple blank lines
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

// ── Generic JSON ────────────────────────────────────────────────────────────

/**
 * Parse generic JSON with a `secrets` array or plain array.
 */
export function parseGenericJSON(json: string): ParsedSecret[] {
  const data = JSON.parse(json);
  const items = data?.secrets || (Array.isArray(data) ? data : []);

  return items
    .map((item: Record<string, unknown>): ParsedSecret | null => {
      const secret = String(item.secret || "").toUpperCase();
      if (!secret) return null;

      return {
        name: String(item.name || item.issuer || "Unknown"),
        account: String(item.account || item.email || ""),
        secret,
        type: ((String(item.type || "TOTP")).toLowerCase()) as OtpType,
        digits: Number(item.digits) || 6,
        period: Number(item.period) || 30,
        algorithm: normalizeAlgorithm(String(item.algorithm || "")),
        counter: Number(item.counter) || 0,
      };
    })
    .filter((s: ParsedSecret | null): s is ParsedSecret => s !== null);
}

// ── Generic CSV ─────────────────────────────────────────────────────────────

/**
 * Parse CSV with headers. Supports common column names.
 */
export function parseGenericCSV(csv: string): ParsedSecret[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  if (!firstLine) return [];

  const headerLine = firstLine.toLowerCase();
  const headers = parseCSVLine(headerLine);

  // Find column indices
  const nameIdx = headers.findIndex((h) =>
    /^(name|service|issuer|服务名称)$/.test(h.trim())
  );
  const accountIdx = headers.findIndex((h) =>
    /^(account|email|username|账户信息|login_username)$/.test(h.trim())
  );
  const secretIdx = headers.findIndex((h) =>
    /^(secret|key|密钥|login_totp)$/.test(h.trim())
  );
  const typeIdx = headers.findIndex((h) =>
    /^(type|otp_type|类型)$/.test(h.trim())
  );
  const digitsIdx = headers.findIndex((h) =>
    /^(digits|位数)$/.test(h.trim())
  );
  const periodIdx = headers.findIndex((h) =>
    /^(period|interval|周期)$/.test(h.trim())
  );
  const algorithmIdx = headers.findIndex((h) =>
    /^(algorithm|algo|算法)$/.test(h.trim())
  );

  if (secretIdx === -1) return [];

  return lines
    .slice(1)
    .map((line): ParsedSecret | null => {
      const cols = parseCSVLine(line);
      const secret = (cols[secretIdx] || "").toUpperCase().replace(/\s/g, "");
      if (!secret) return null;

      return {
        name: cols[nameIdx] || "Unknown",
        account: cols[accountIdx] || "",
        secret,
        type: ((cols[typeIdx] || "TOTP").toLowerCase()) as OtpType,
        digits: parseInt(cols[digitsIdx] || "6", 10) || 6,
        period: parseInt(cols[periodIdx] || "30", 10) || 30,
        algorithm: normalizeAlgorithm(cols[algorithmIdx]),
        counter: 0,
      };
    })
    .filter((s): s is ParsedSecret => s !== null);
}

// ── Format Detection & Unified Parse ────────────────────────────────────────

// Re-export ImportFormat from canonical source
export type { ImportFormat } from "./types";

/**
 * Auto-detect import format from content.
 */
export function detectImportFormat(content: string): ImportFormat | null {
  const trimmed = content.trim();

  // OTPAuth URIs
  if (trimmed.startsWith("otpauth://")) return "otpauth-uri";

  // RTF (Step Two iCloud Data Report)
  if (trimmed.startsWith("{\\rtf") && /Step Two/i.test(trimmed)) return "step-two";

  // JSON formats
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const data = JSON.parse(trimmed);

      if (data?.db?.entries) return "aegis";
      if (data?.services && data?.schemaVersion !== undefined) return "2fas";
      if (data?.items?.[0]?.login !== undefined) return "bitwarden";
      if (data?.accounts && data?.version !== undefined) return "lastpass";
      if (data?.entries?.[0]?.content?.uri) return "proton";
      if (data?.Authenticators) return "authenticator-pro";
      if (data?.tokens) return "freeotp-plus";
      if (Array.isArray(data) && data[0]?.thumbnail !== undefined) return "andotp";
      if (Array.isArray(data) && data[0]?.issuer !== undefined) return "raivo";
      if (data?.secrets || (Array.isArray(data) && data[0]?.secret !== undefined))
        return "generic-json";

      return "generic-json";
    } catch {
      return null;
    }
  }

  // CSV
  const firstLine = (trimmed.split(/\r?\n/)[0] ?? "").toLowerCase();
  if (
    firstLine.includes(",") &&
    (firstLine.includes("secret") ||
      firstLine.includes("密钥") ||
      firstLine.includes("login_totp"))
  ) {
    return "generic-csv";
  }

  // Multi-line otpauth URIs
  if (trimmed.split(/\r?\n/).some((l) => l.trim().startsWith("otpauth://"))) {
    return "otpauth-uri";
  }

  return null;
}

/**
 * Parse import content with auto-detection or explicit format.
 */
export function parseImport(
  content: string,
  format?: ImportFormat
): ParsedSecret[] {
  const detectedFormat = format || detectImportFormat(content);
  if (!detectedFormat) return [];

  switch (detectedFormat) {
    case "otpauth-uri":
      return parseOtpauthUris(content);
    case "aegis":
      return parseAegis(content);
    case "2fas":
      return parse2FAS(content);
    case "bitwarden":
      return parseBitwarden(content);
    case "andotp":
      return parseAndOTP(content);
    case "lastpass":
      return parseLastPass(content);
    case "proton":
      return parseProton(content);
    case "authenticator-pro":
      return parseAuthenticatorPro(content);
    case "freeotp-plus":
      return parseFreeOTPPlus(content);
    case "google-authenticator":
      return parseGoogleAuthenticator(content);
    case "ente-auth":
      return parseEnteAuth(content);
    case "winauth":
      return parseWinAuth(content);
    case "raivo":
      return parseRaivo(content);
    case "step-two":
      return parseStepTwo(content);
    case "generic-json":
      return parseGenericJSON(content);
    case "generic-csv":
      return parseGenericCSV(content);
    default:
      return [];
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function normalizeAlgorithm(alg?: string | null): OtpAlgorithm {
  if (!alg) return "SHA-1";
  const upper = alg.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (upper === "SHA256") return "SHA-256";
  if (upper === "SHA512") return "SHA-512";
  return "SHA-1";
}

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function bytesToBase32(bytes: Uint8Array): string {
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

/**
 * Parse a CSV line handling quoted fields (RFC 4180).
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}
