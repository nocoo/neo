/**
 * Import parser tests.
 * Covers otpauth URI parsing, all JSON format parsers,
 * CSV parsing, format detection, and the unified parseImport entry.
 */

import { describe, it, expect } from "vitest";
import {
  parseOtpauthUri,
  parseOtpauthUris,
  parseAegis,
  parse2FAS,
  parseBitwarden,
  parseAndOTP,
  parseLastPass,
  parseProton,
  parseAuthenticatorPro,
  parseFreeOTPPlus,
  parseRaivo,
  parseGenericJSON,
  parseGenericCSV,
  detectImportFormat,
  parseImport,
} from "@/models/import-parsers";

// ── parseOtpauthUri ─────────────────────────────────────────────────────────

describe("parseOtpauthUri", () => {
  it("parses a standard TOTP URI", () => {
    const uri = "otpauth://totp/GitHub:user%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30&algorithm=SHA1";
    const result = parseOtpauthUri(uri);
    expect(result).not.toBeNull();
    expect(result!.name).toBe("GitHub");
    expect(result!.account).toBe("user@example.com");
    expect(result!.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(result!.type).toBe("totp");
    expect(result!.digits).toBe(6);
    expect(result!.period).toBe(30);
    expect(result!.algorithm).toBe("SHA-1");
  });

  it("parses a HOTP URI with counter", () => {
    const uri = "otpauth://hotp/Service?secret=JBSWY3DPEHPK3PXP&counter=42";
    const result = parseOtpauthUri(uri);
    expect(result).not.toBeNull();
    expect(result!.type).toBe("hotp");
    expect(result!.counter).toBe(42);
  });

  it("handles URI without issuer (uses path as name)", () => {
    const uri = "otpauth://totp/MyService?secret=JBSWY3DPEHPK3PXP";
    const result = parseOtpauthUri(uri);
    expect(result!.name).toBe("MyService");
  });

  it("handles SHA-256 and SHA-512 algorithms", () => {
    const uri256 = "otpauth://totp/Test?secret=ABC&algorithm=SHA256";
    expect(parseOtpauthUri(uri256)!.algorithm).toBe("SHA-256");

    const uri512 = "otpauth://totp/Test?secret=ABC&algorithm=SHA512";
    expect(parseOtpauthUri(uri512)!.algorithm).toBe("SHA-512");
  });

  it("returns null for invalid URIs", () => {
    expect(parseOtpauthUri("")).toBeNull();
    expect(parseOtpauthUri("https://example.com")).toBeNull();
    expect(parseOtpauthUri("otpauth://invalid/Test?secret=ABC")).toBeNull();
  });

  it("returns null for URI without secret", () => {
    expect(parseOtpauthUri("otpauth://totp/Test")).toBeNull();
  });

  it("defaults to 6 digits and 30s period", () => {
    const uri = "otpauth://totp/Test?secret=ABC";
    const result = parseOtpauthUri(uri);
    expect(result!.digits).toBe(6);
    expect(result!.period).toBe(30);
  });

  it("supports 8-digit OTP", () => {
    const uri = "otpauth://totp/Test?secret=ABC&digits=8";
    expect(parseOtpauthUri(uri)!.digits).toBe(8);
  });
});

// ── parseOtpauthUris ────────────────────────────────────────────────────────

describe("parseOtpauthUris", () => {
  it("parses multiple URIs from text", () => {
    const text = [
      "otpauth://totp/GitHub?secret=AAAA&issuer=GitHub",
      "otpauth://totp/Google?secret=BBBB&issuer=Google",
      "# comment line",
      "",
      "otpauth://hotp/Service?secret=CCCC&counter=5",
    ].join("\n");

    const results = parseOtpauthUris(text);
    expect(results).toHaveLength(3);
    expect(results[0].name).toBe("GitHub");
    expect(results[2].type).toBe("hotp");
  });

  it("returns empty array for empty text", () => {
    expect(parseOtpauthUris("")).toHaveLength(0);
  });
});

// ── parseAegis ──────────────────────────────────────────────────────────────

describe("parseAegis", () => {
  it("parses Aegis JSON", () => {
    const json = JSON.stringify({
      db: {
        entries: [
          { type: "totp", issuer: "GitHub", name: "user@gh.com", info: { secret: "JBSWY3DP", digits: 6, period: 30, algo: "SHA1" } },
          { type: "hotp", issuer: "Service", name: "admin", info: { secret: "MFRGGZDF", counter: 10 } },
        ],
      },
    });

    const results = parseAegis(json);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].account).toBe("user@gh.com");
    expect(results[1].type).toBe("hotp");
    expect(results[1].counter).toBe(10);
  });

  it("skips entries without secrets", () => {
    const json = JSON.stringify({
      db: { entries: [{ type: "totp", issuer: "NoSecret", info: {} }] },
    });
    expect(parseAegis(json)).toHaveLength(0);
  });
});

// ── parse2FAS ───────────────────────────────────────────────────────────────

describe("parse2FAS", () => {
  it("parses 2FAS JSON", () => {
    const json = JSON.stringify({
      schemaVersion: 3,
      services: [
        {
          name: "GitHub",
          secret: "JBSWY3DP",
          otp: { tokenType: "TOTP", issuer: "GitHub", account: "user", digits: 6, period: 30, algorithm: "SHA1" },
        },
      ],
    });

    const results = parse2FAS(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].account).toBe("user");
  });
});

// ── parseBitwarden ──────────────────────────────────────────────────────────

describe("parseBitwarden", () => {
  it("parses Bitwarden JSON with plain secrets", () => {
    const json = JSON.stringify({
      items: [
        { name: "GitHub", login: { username: "user", totp: "JBSWY3DP" } },
        { name: "NoTOTP", login: { username: "user" } },
      ],
    });

    const results = parseBitwarden(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].secret).toBe("JBSWY3DP");
  });

  it("parses Bitwarden with otpauth URIs", () => {
    const json = JSON.stringify({
      items: [
        { name: "Test", login: { totp: "otpauth://totp/Test?secret=ABC&issuer=Test" } },
      ],
    });

    const results = parseBitwarden(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Test");
  });
});

// ── parseAndOTP ─────────────────────────────────────────────────────────────

describe("parseAndOTP", () => {
  it("parses andOTP JSON array", () => {
    const json = JSON.stringify([
      { secret: "JBSWY3DP", issuer: "GitHub", label: "user", type: "TOTP", digits: 6, period: 30, algorithm: "SHA1", thumbnail: "default" },
    ]);

    const results = parseAndOTP(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
  });

  it("returns empty for non-array JSON", () => {
    expect(parseAndOTP(JSON.stringify({ not: "array" }))).toHaveLength(0);
  });
});

// ── parseLastPass ───────────────────────────────────────────────────────────

describe("parseLastPass", () => {
  it("parses LastPass JSON", () => {
    const json = JSON.stringify({
      version: 1,
      accounts: [
        { issuerName: "GitHub", userName: "user", secret: "JBSWY3DP", digits: 6, timeStep: 30 },
      ],
    });

    const results = parseLastPass(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].period).toBe(30);
  });
});

// ── parseProton ─────────────────────────────────────────────────────────────

describe("parseProton", () => {
  it("parses Proton JSON with URIs", () => {
    const json = JSON.stringify({
      version: 1,
      entries: [
        { content: { uri: "otpauth://totp/GitHub?secret=JBSWY3DP&issuer=GitHub" } },
      ],
    });

    const results = parseProton(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
  });

  it("skips entries without URI", () => {
    const json = JSON.stringify({ entries: [{ name: "NoURI" }] });
    expect(parseProton(json)).toHaveLength(0);
  });
});

// ── parseAuthenticatorPro ───────────────────────────────────────────────────

describe("parseAuthenticatorPro", () => {
  it("parses Authenticator Pro JSON", () => {
    const json = JSON.stringify({
      Authenticators: [
        { Issuer: "GitHub", Username: "user", Secret: "JBSWY3DP", Type: 1, Digits: 6, Period: 30, Algorithm: 0 },
      ],
    });

    const results = parseAuthenticatorPro(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].algorithm).toBe("SHA-1");
  });

  it("maps algorithm numbers correctly", () => {
    const json = JSON.stringify({
      Authenticators: [
        { Secret: "ABC", Algorithm: 1 },
        { Secret: "DEF", Algorithm: 2 },
      ],
    });

    const results = parseAuthenticatorPro(json);
    expect(results[0].algorithm).toBe("SHA-256");
    expect(results[1].algorithm).toBe("SHA-512");
  });
});

// ── parseFreeOTPPlus ────────────────────────────────────────────────────────

describe("parseFreeOTPPlus", () => {
  it("parses FreeOTP+ JSON with byte arrays", () => {
    // "Hello!" in bytes
    const json = JSON.stringify({
      tokens: [
        { issuerExt: "Test", label: "user", secret: [72, 101, 108, 108, 111, 33], type: "TOTP", digits: 6, period: 30 },
      ],
    });

    const results = parseFreeOTPPlus(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Test");
    expect(results[0].secret.length).toBeGreaterThan(0);
  });

  it("handles negative bytes (Java signed)", () => {
    const json = JSON.stringify({
      tokens: [{ secret: [-1, -128, 127, 0], type: "TOTP" }],
    });

    const results = parseFreeOTPPlus(json);
    expect(results).toHaveLength(1);
  });
});

// ── parseRaivo ──────────────────────────────────────────────────────────────

describe("parseRaivo", () => {
  it("parses Raivo JSON array", () => {
    const json = JSON.stringify([
      { issuer: "GitHub", account: "user", secret: "JBSWY3DP", algorithm: "SHA1", digits: 6, kind: "TOTP", timer: 30 },
    ]);

    const results = parseRaivo(json);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].period).toBe(30);
  });
});

// ── parseGenericJSON ────────────────────────────────────────────────────────

describe("parseGenericJSON", () => {
  it("parses {secrets: [...]} format", () => {
    const json = JSON.stringify({
      secrets: [
        { name: "GitHub", secret: "JBSWY3DP", type: "TOTP" },
        { name: "Google", secret: "MFRGGZDF" },
      ],
    });

    const results = parseGenericJSON(json);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("GitHub");
  });

  it("parses plain array format", () => {
    const json = JSON.stringify([
      { name: "Test", secret: "JBSWY3DP" },
    ]);

    const results = parseGenericJSON(json);
    expect(results).toHaveLength(1);
  });

  it("skips entries without secret", () => {
    const json = JSON.stringify([{ name: "NoSecret" }]);
    expect(parseGenericJSON(json)).toHaveLength(0);
  });
});

// ── parseGenericCSV ─────────────────────────────────────────────────────────

describe("parseGenericCSV", () => {
  it("parses CSV with standard headers", () => {
    const csv = [
      "name,account,secret,type,digits,period,algorithm",
      "GitHub,user@example.com,JBSWY3DP,TOTP,6,30,SHA1",
      "Google,user@gmail.com,MFRGGZDF,TOTP,8,60,SHA256",
    ].join("\n");

    const results = parseGenericCSV(csv);
    expect(results).toHaveLength(2);
    expect(results[0].name).toBe("GitHub");
    expect(results[0].account).toBe("user@example.com");
    expect(results[1].digits).toBe(8);
  });

  it("handles quoted fields", () => {
    const csv = [
      "name,secret",
      '"Service, Inc.",JBSWY3DP',
    ].join("\n");

    const results = parseGenericCSV(csv);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Service, Inc.");
  });

  it("returns empty for CSV without secret column", () => {
    const csv = "name,value\nTest,123";
    expect(parseGenericCSV(csv)).toHaveLength(0);
  });

  it("returns empty for single-line CSV", () => {
    expect(parseGenericCSV("name,secret")).toHaveLength(0);
  });
});

// ── detectImportFormat ──────────────────────────────────────────────────────

describe("detectImportFormat", () => {
  it("detects otpauth URI", () => {
    expect(detectImportFormat("otpauth://totp/Test?secret=ABC")).toBe("otpauth-uri");
  });

  it("detects Aegis", () => {
    expect(detectImportFormat(JSON.stringify({ db: { entries: [] } }))).toBe("aegis");
  });

  it("detects 2FAS", () => {
    expect(detectImportFormat(JSON.stringify({ services: [], schemaVersion: 3 }))).toBe("2fas");
  });

  it("detects Bitwarden", () => {
    expect(detectImportFormat(JSON.stringify({ items: [{ login: {} }] }))).toBe("bitwarden");
  });

  it("detects LastPass", () => {
    expect(detectImportFormat(JSON.stringify({ version: 1, accounts: [] }))).toBe("lastpass");
  });

  it("detects Proton", () => {
    expect(detectImportFormat(JSON.stringify({ entries: [{ content: { uri: "otpauth://totp/X?secret=A" } }] }))).toBe("proton");
  });

  it("detects Authenticator Pro", () => {
    expect(detectImportFormat(JSON.stringify({ Authenticators: [] }))).toBe("authenticator-pro");
  });

  it("detects FreeOTP+", () => {
    expect(detectImportFormat(JSON.stringify({ tokens: [] }))).toBe("freeotp-plus");
  });

  it("detects andOTP", () => {
    expect(detectImportFormat(JSON.stringify([{ thumbnail: "default" }]))).toBe("andotp");
  });

  it("detects Raivo", () => {
    expect(detectImportFormat(JSON.stringify([{ issuer: "X" }]))).toBe("raivo");
  });

  it("detects generic JSON with secrets array", () => {
    expect(detectImportFormat(JSON.stringify({ secrets: [{ secret: "A" }] }))).toBe("generic-json");
  });

  it("detects generic JSON for unknown JSON structure", () => {
    expect(detectImportFormat(JSON.stringify({ unknown: true }))).toBe("generic-json");
  });

  it("detects CSV", () => {
    expect(detectImportFormat("name,secret\nTest,ABC")).toBe("generic-csv");
  });

  it("detects CSV with Chinese headers", () => {
    expect(detectImportFormat("服务名称,密钥\nTest,ABC")).toBe("generic-csv");
  });

  it("detects CSV with login_totp header", () => {
    expect(detectImportFormat("name,login_totp\nTest,ABC")).toBe("generic-csv");
  });

  it("detects multi-line otpauth URIs", () => {
    expect(detectImportFormat("Some header\notpauth://totp/T?secret=A")).toBe("otpauth-uri");
  });

  it("returns null for unrecognized content", () => {
    expect(detectImportFormat("random garbage")).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(detectImportFormat("{invalid json")).toBeNull();
  });
});

// ── parseImport (unified) ───────────────────────────────────────────────────

describe("parseImport", () => {
  it("auto-detects and parses otpauth URIs", () => {
    const text = "otpauth://totp/GitHub?secret=JBSWY3DP&issuer=GitHub";
    const results = parseImport(text);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("GitHub");
  });

  it("parses with explicit format", () => {
    const json = JSON.stringify({ db: { entries: [{ type: "totp", issuer: "Test", info: { secret: "ABC" } }] } });
    const results = parseImport(json, "aegis");
    expect(results).toHaveLength(1);
  });

  it("returns empty for unrecognized content", () => {
    expect(parseImport("garbage")).toHaveLength(0);
  });

  it("routes to 2fas parser with explicit format", () => {
    const json = JSON.stringify({ services: [{ name: "X", secret: "ABC", otp: { tokenType: "TOTP" } }], schemaVersion: 3 });
    expect(parseImport(json, "2fas")).toHaveLength(1);
  });

  it("routes to bitwarden parser with explicit format", () => {
    const json = JSON.stringify({ items: [{ name: "X", login: { totp: "ABCD" } }] });
    expect(parseImport(json, "bitwarden")).toHaveLength(1);
  });

  it("routes to andotp parser with explicit format", () => {
    const json = JSON.stringify([{ secret: "ABC", issuer: "X", thumbnail: "default" }]);
    expect(parseImport(json, "andotp")).toHaveLength(1);
  });

  it("routes to lastpass parser with explicit format", () => {
    const json = JSON.stringify({ version: 1, accounts: [{ issuerName: "X", secret: "ABC" }] });
    expect(parseImport(json, "lastpass")).toHaveLength(1);
  });

  it("routes to proton parser with explicit format", () => {
    const json = JSON.stringify({ entries: [{ content: { uri: "otpauth://totp/X?secret=ABC" } }] });
    expect(parseImport(json, "proton")).toHaveLength(1);
  });

  it("routes to authenticator-pro parser with explicit format", () => {
    const json = JSON.stringify({ Authenticators: [{ Secret: "ABC", Type: 1 }] });
    expect(parseImport(json, "authenticator-pro")).toHaveLength(1);
  });

  it("routes to freeotp-plus parser with explicit format", () => {
    const json = JSON.stringify({ tokens: [{ secret: [72, 101], type: "TOTP" }] });
    expect(parseImport(json, "freeotp-plus")).toHaveLength(1);
  });

  it("routes to google-authenticator parser", () => {
    expect(parseImport("otpauth://totp/X?secret=ABC", "google-authenticator")).toHaveLength(1);
  });

  it("routes to ente-auth parser", () => {
    expect(parseImport("otpauth://totp/X?secret=ABC", "ente-auth")).toHaveLength(1);
  });

  it("routes to winauth parser", () => {
    expect(parseImport("otpauth://totp/X?secret=ABC", "winauth")).toHaveLength(1);
  });

  it("routes to raivo parser with explicit format", () => {
    const json = JSON.stringify([{ issuer: "X", secret: "ABC", algorithm: "SHA1", kind: "TOTP", timer: 30 }]);
    expect(parseImport(json, "raivo")).toHaveLength(1);
  });

  it("routes to generic-json parser with explicit format", () => {
    const json = JSON.stringify({ secrets: [{ name: "X", secret: "ABC" }] });
    expect(parseImport(json, "generic-json")).toHaveLength(1);
  });

  it("routes to generic-csv parser with explicit format", () => {
    expect(parseImport("name,secret\nX,ABC", "generic-csv")).toHaveLength(1);
  });
});
