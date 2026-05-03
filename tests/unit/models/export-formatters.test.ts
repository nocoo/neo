/**
 * Export formatter tests.
 * Covers all format exporters, round-trip with import parsers,
 * and the unified exportSecrets entry.
 */

import { describe, it, expect } from "vitest";
import {
  toOtpauthUri,
  exportAsOtpauthUris,
  exportAsAegis,
  exportAs2FAS,
  exportAsAndOTP,
  exportAsBitwarden,
  exportAsLastPass,
  exportAsProton,
  exportAsAuthenticatorPro,
  exportAsFreeOTPPlus,
  exportAsGenericJSON,
  exportAsCSV,
  exportAsText,
  exportSecrets,
} from "@/models/export-formatters";
import {
  parseOtpauthUri,
  parseAegis,
  parse2FAS,
  parseBitwarden,
  parseAndOTP,
  parseLastPass,
  parseProton,
  parseAuthenticatorPro,
  parseFreeOTPPlus,
  parseGenericJSON,
  parseGenericCSV,
} from "@/models/import-parsers";
import type { ParsedSecret } from "@/models/types";

const SAMPLE_SECRETS: ParsedSecret[] = [
  {
    name: "GitHub",
    account: "user@example.com",
    secret: "JBSWY3DPEHPK3PXP",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
  {
    name: "Google",
    account: "admin@gmail.com",
    secret: "MFRGGZDFMZTWQ2LK",
    type: "totp",
    digits: 8,
    period: 60,
    algorithm: "SHA-256",
    counter: 0,
  },
];

const HOTP_SECRET: ParsedSecret = {
  name: "HotpService",
  account: "user",
  secret: "KRSXG5CTMVRXEZLU",
  type: "hotp",
  digits: 6,
  period: 30,
  algorithm: "SHA-1",
  counter: 42,
};

// ── toOtpauthUri ────────────────────────────────────────────────────────────

describe("toOtpauthUri", () => {
  it("builds a valid TOTP URI", () => {
    const uri = toOtpauthUri(SAMPLE_SECRETS[0]!);
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(uri).toContain("issuer=GitHub");
    expect(uri).toContain("period=30");
    expect(uri).toContain("digits=6");
  });

  it("builds a valid HOTP URI with counter", () => {
    const uri = toOtpauthUri(HOTP_SECRET);
    expect(uri).toContain("otpauth://hotp/");
    expect(uri).toContain("counter=42");
    expect(uri).not.toContain("period=");
  });

  it("round-trips with parseOtpauthUri", () => {
    const uri = toOtpauthUri(SAMPLE_SECRETS[0]!);
    const parsed = parseOtpauthUri(uri);
    expect(parsed).not.toBeNull();
    expect(parsed!.name).toBe("GitHub");
    expect(parsed!.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(parsed!.digits).toBe(6);
  });
});

// ── exportAsOtpauthUris ─────────────────────────────────────────────────────

describe("exportAsOtpauthUris", () => {
  it("produces one URI per line", () => {
    const result = exportAsOtpauthUris(SAMPLE_SECRETS);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]!).toContain("otpauth://totp/");
    expect(lines[1]!).toContain("otpauth://totp/");
  });

  it("handles empty array", () => {
    expect(exportAsOtpauthUris([])).toBe("");
  });
});

// ── Aegis round-trip ────────────────────────────────────────────────────────

describe("exportAsAegis", () => {
  it("produces valid Aegis JSON", () => {
    const json = exportAsAegis(SAMPLE_SECRETS);
    const data = JSON.parse(json);
    expect(data.db.entries).toHaveLength(2);
    expect(data.db.entries[0].issuer).toBe("GitHub");
  });

  it("round-trips through parseAegis", () => {
    const exported = exportAsAegis(SAMPLE_SECRETS);
    const imported = parseAegis(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
    expect(imported[0]!.secret).toBe("JBSWY3DPEHPK3PXP");
  });
});

// ── 2FAS round-trip ─────────────────────────────────────────────────────────

describe("exportAs2FAS", () => {
  it("round-trips through parse2FAS", () => {
    const exported = exportAs2FAS(SAMPLE_SECRETS);
    const imported = parse2FAS(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
  });
});

// ── andOTP round-trip ───────────────────────────────────────────────────────

describe("exportAsAndOTP", () => {
  it("round-trips through parseAndOTP", () => {
    const exported = exportAsAndOTP(SAMPLE_SECRETS);
    const imported = parseAndOTP(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
  });
});

// ── Bitwarden round-trip ────────────────────────────────────────────────────

describe("exportAsBitwarden", () => {
  it("round-trips through parseBitwarden", () => {
    const exported = exportAsBitwarden(SAMPLE_SECRETS);
    const imported = parseBitwarden(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
  });
});

// ── LastPass round-trip ─────────────────────────────────────────────────────

describe("exportAsLastPass", () => {
  it("round-trips through parseLastPass", () => {
    const exported = exportAsLastPass(SAMPLE_SECRETS);
    const imported = parseLastPass(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
    expect(imported[0]!.period).toBe(30);
  });
});

// ── Proton round-trip ───────────────────────────────────────────────────────

describe("exportAsProton", () => {
  it("round-trips through parseProton", () => {
    const exported = exportAsProton(SAMPLE_SECRETS);
    const imported = parseProton(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
  });
});

// ── Authenticator Pro round-trip ────────────────────────────────────────────

describe("exportAsAuthenticatorPro", () => {
  it("round-trips through parseAuthenticatorPro", () => {
    const exported = exportAsAuthenticatorPro(SAMPLE_SECRETS);
    const imported = parseAuthenticatorPro(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
    expect(imported[0]!.algorithm).toBe("SHA-1");
    expect(imported[1]!.algorithm).toBe("SHA-256");
  });
});

// ── FreeOTP+ round-trip ─────────────────────────────────────────────────────

describe("exportAsFreeOTPPlus", () => {
  it("round-trips through parseFreeOTPPlus", () => {
    const exported = exportAsFreeOTPPlus(SAMPLE_SECRETS);
    const imported = parseFreeOTPPlus(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
  });
});

// ── Generic JSON round-trip ─────────────────────────────────────────────────

describe("exportAsGenericJSON", () => {
  it("round-trips through parseGenericJSON", () => {
    const exported = exportAsGenericJSON(SAMPLE_SECRETS);
    const imported = parseGenericJSON(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
    expect(imported[0]!.secret).toBe("JBSWY3DPEHPK3PXP");
  });
});

// ── CSV ─────────────────────────────────────────────────────────────────────

describe("exportAsCSV", () => {
  it("produces valid CSV with headers", () => {
    const csv = exportAsCSV(SAMPLE_SECRETS);
    const lines = csv.split("\n");
    expect(lines[0]!).toBe("name,account,secret,type,digits,period,algorithm,counter");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("round-trips through parseGenericCSV", () => {
    const exported = exportAsCSV(SAMPLE_SECRETS);
    const imported = parseGenericCSV(exported);
    expect(imported).toHaveLength(2);
    expect(imported[0]!.name).toBe("GitHub");
    expect(imported[0]!.secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("escapes commas in names", () => {
    const secrets: ParsedSecret[] = [
      { ...SAMPLE_SECRETS[0]!, name: "Service, Inc." },
    ];
    const csv = exportAsCSV(secrets);
    expect(csv).toContain('"Service, Inc."');
  });
});

// ── Text ────────────────────────────────────────────────────────────────────

describe("exportAsText", () => {
  it("produces readable text", () => {
    const text = exportAsText(SAMPLE_SECRETS);
    expect(text).toContain("GitHub (user@example.com): JBSWY3DPEHPK3PXP");
    expect(text).toContain("Google (admin@gmail.com): MFRGGZDFMZTWQ2LK");
  });

  it("omits parentheses when no account", () => {
    const secrets: ParsedSecret[] = [
      { ...SAMPLE_SECRETS[0]!, account: "" },
    ];
    const text = exportAsText(secrets);
    expect(text).toBe("GitHub: JBSWY3DPEHPK3PXP");
  });
});

// ── exportSecrets (unified) ─────────────────────────────────────────────────

describe("exportSecrets", () => {
  it("routes to the correct formatter", () => {
    const formats: Array<[string, string]> = [
      ["otpauth-uri", "otpauth://"],
      ["aegis", '"db"'],
      ["2fas", '"schemaVersion"'],
      ["andotp", '"thumbnail"'],
      ["bitwarden", '"items"'],
      ["lastpass", '"accounts"'],
      ["proton", '"entries"'],
      ["authenticator-pro", '"Authenticators"'],
      ["freeotp-plus", '"tokens"'],
      ["generic-json", '"secrets"'],
      ["generic-csv", "name,account"],
      ["generic-txt", "GitHub"],
    ];

    formats.forEach(([format, expected]) => {
      const result = exportSecrets(SAMPLE_SECRETS, format as Parameters<typeof exportSecrets>[1]);
      expect(result).toContain(expected);
    });
  });

  it("throws for unknown format", () => {
    expect(() =>
      exportSecrets(SAMPLE_SECRETS, "unknown" as Parameters<typeof exportSecrets>[1])
    ).toThrow("Unsupported export format");
  });

  it("handles empty secrets array", () => {
    const result = exportSecrets([], "generic-json");
    expect(JSON.parse(result).secrets).toHaveLength(0);
  });
});

// ── Fallback branches for missing/zero fields ───────────────────────────────

const EMPTY_SECRET: ParsedSecret = {
  name: "Service",
  account: "",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp",
  digits: 0,
  period: 0,
  algorithm: "SHA-1",
  counter: 0,
};

const HOTP_NO_DEFAULTS: ParsedSecret = {
  ...EMPTY_SECRET,
  type: "hotp",
};

const UNKNOWN_ALG: ParsedSecret = {
  ...EMPTY_SECRET,
  algorithm: "MD5" as ParsedSecret["algorithm"],
};

describe("export formatters — fallback branches", () => {
  it("toOtpauthUri uses defaults and omits account label when empty", () => {
    const uri = toOtpauthUri(EMPTY_SECRET);
    expect(uri).toContain("otpauth://totp/Service?");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
  });

  it("toOtpauthUri HOTP uses default counter", () => {
    const uri = toOtpauthUri(HOTP_NO_DEFAULTS);
    expect(uri).toContain("otpauth://hotp/");
    expect(uri).toContain("counter=0");
  });

  it("exportAsAegis uses name when account empty and falls back on digits/period", () => {
    const out = JSON.parse(exportAsAegis([EMPTY_SECRET]));
    expect(out.db.entries[0].name).toBe("Service");
    expect(out.db.entries[0].info.digits).toBe(6);
    expect(out.db.entries[0].info.period).toBe(30);
  });

  it("exportAsAegis HOTP includes counter fallback", () => {
    const out = JSON.parse(exportAsAegis([HOTP_NO_DEFAULTS]));
    expect(out.db.entries[0].info.counter).toBe(0);
  });

  it("exportAs2FAS uses fallbacks for missing values", () => {
    const out = JSON.parse(exportAs2FAS([EMPTY_SECRET]));
    expect(out.services[0].otp.digits).toBe(6);
    expect(out.services[0].otp.period).toBe(30);
    expect(out.services[0].otp.counter).toBe(0);
    expect(out.services[0].otp.account).toBe("");
  });

  it("exportAsAndOTP HOTP includes counter fallback", () => {
    const out = JSON.parse(exportAsAndOTP([HOTP_NO_DEFAULTS]));
    expect(out[0].counter).toBe(0);
    expect(out[0].label).toBe("Service");
  });

  it("exportAsBitwarden defaults username when account empty", () => {
    const out = JSON.parse(exportAsBitwarden([EMPTY_SECRET]));
    expect(out.items[0].login.username).toBe("");
  });

  it("exportAsLastPass uses defaults for digits/period", () => {
    const out = JSON.parse(exportAsLastPass([EMPTY_SECRET]));
    expect(out.accounts[0].digits).toBe(6);
    expect(out.accounts[0].timeStep).toBe(30);
    expect(out.accounts[0].userName).toBe("");
  });

  it("exportAsAuthenticatorPro HOTP uses Type=2 and falls back on counter", () => {
    const out = JSON.parse(exportAsAuthenticatorPro([HOTP_NO_DEFAULTS]));
    expect(out.Authenticators[0].Type).toBe(2);
    expect(out.Authenticators[0].Counter).toBe(0);
    expect(out.Authenticators[0].Digits).toBe(6);
    expect(out.Authenticators[0].Period).toBe(30);
  });

  it("exportAsAuthenticatorPro uses 0 for unknown algorithm", () => {
    const out = JSON.parse(exportAsAuthenticatorPro([UNKNOWN_ALG]));
    expect(out.Authenticators[0].Algorithm).toBe(0);
  });

  it("exportAsFreeOTPPlus uses defaults", () => {
    const out = JSON.parse(exportAsFreeOTPPlus([EMPTY_SECRET]));
    expect(out.tokens[0].digits).toBe(6);
    expect(out.tokens[0].period).toBe(30);
    expect(out.tokens[0].counter).toBe(0);
    expect(out.tokens[0].label).toBe("Service");
  });

  it("exportAsCSV uses defaults for missing numeric fields", () => {
    const csv = exportAsCSV([EMPTY_SECRET]);
    const fields = csv.split("\n")[1]!.split(",");
    expect(fields[4]).toBe("6");
    expect(fields[5]).toBe("30");
    expect(fields[7]).toBe("0");
  });

  it("exportAsCSV escapes embedded quotes and newlines", () => {
    const csv = exportAsCSV([{ ...EMPTY_SECRET, name: 'A"B', account: "x\ny" }]);
    expect(csv).toContain('"A""B"');
    expect(csv).toContain('"x\ny"');
  });

  it("denormalizeAlgorithm falls back to SHA1 for unknown algorithms", () => {
    const uri = toOtpauthUri(UNKNOWN_ALG);
    expect(uri).toContain("algorithm=SHA1");
  });
});
