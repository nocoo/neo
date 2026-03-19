/**
 * Validation tests — migrated from 2fa project.
 * Preserves Base32 validation, OTP parameter checks, secret data
 * validation, normalization, sorting, and duplicate detection.
 */

import { describe, it, expect } from "vitest";
import {
  validateBase32,
  validateSecretData,
  validateOTPParams,
  createSecretObject,
  sortSecretsByName,
  checkDuplicateSecret,
  validateBatchImport,
} from "@/models/validation";

// ── validateBase32 ──────────────────────────────────────────────────────────

describe("validateBase32", () => {
  it("accepts valid Base32 secrets", () => {
    const valid = [
      "JBSWY3DPEHPK3PXP",
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
      "MFRGGZDFMZTWQ2LK",
      "KRSXG5CTMVRXEZLU",
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====",
    ];

    valid.forEach((secret) => {
      expect(validateBase32(secret).valid).toBe(true);
    });
  });

  it("rejects empty / null / undefined secrets", () => {
    expect(validateBase32("").valid).toBe(false);
    expect(validateBase32("   ").valid).toBe(false);
    expect(validateBase32(null).valid).toBe(false);
    expect(validateBase32(undefined).valid).toBe(false);
  });

  it("rejects invalid Base32 characters (0, 1, 8, 9)", () => {
    expect(validateBase32("INVALID0").valid).toBe(false);
    expect(validateBase32("INVALID1").valid).toBe(false);
    expect(validateBase32("INVALID8").valid).toBe(false);
    expect(validateBase32("INVALID9").valid).toBe(false);
  });

  it("rejects secrets shorter than 8 chars", () => {
    const result = validateBase32("JBSWY3D");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too short");
  });

  it("warns about weak keys (< 80 bit)", () => {
    const result = validateBase32("JBSWY3DP"); // 8 chars = 40 bits
    expect(result.valid).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("Weak");
  });

  it("warns about moderate keys (80-127 bit)", () => {
    // 17 chars → 10 decoded bytes → 80 bits
    const result = validateBase32("JBSWY3DPEHPK3PXPA");
    expect(result.valid).toBe(true);
    expect(result.warning).toBeDefined();
    expect(result.warning).toContain("Moderate");
  });

  it("accepts strong keys (≥128 bit) without warning", () => {
    const result = validateBase32("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });

  it("handles padding characters", () => {
    const result = validateBase32("JBSWY3DPEHPK3PXP====");
    expect(result.valid).toBe(true);
  });

  it("auto-uppercases and strips whitespace", () => {
    const result = validateBase32("jbswy3dp ehpk 3pxp");
    expect(result.valid).toBe(true);
  });

  it("handles very long keys", () => {
    const longSecret = "JBSWY3DP".repeat(100);
    const result = validateBase32(longSecret);
    expect(result.valid).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});

// ── validateSecretData ──────────────────────────────────────────────────────

describe("validateSecretData", () => {
  it("accepts valid secret data", () => {
    expect(
      validateSecretData({ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" }).valid
    ).toBe(true);
  });

  it("rejects empty service name", () => {
    const r = validateSecretData({ name: "", secret: "JBSWY3DPEHPK3PXP" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("name is required");
  });

  it("rejects whitespace-only service name", () => {
    const r = validateSecretData({ name: "   ", secret: "JBSWY3DPEHPK3PXP" });
    expect(r.valid).toBe(false);
  });

  it("rejects name longer than 50 chars", () => {
    const r = validateSecretData({ name: "A".repeat(51), secret: "JBSWY3DPEHPK3PXP" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("too long");
  });

  it("accepts name of exactly 50 chars", () => {
    expect(
      validateSecretData({ name: "A".repeat(50), secret: "JBSWY3DPEHPK3PXP" }).valid
    ).toBe(true);
  });

  it("rejects empty secret", () => {
    const r = validateSecretData({ name: "GitHub", secret: "" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Secret is required");
  });

  it("rejects invalid Base32 secret", () => {
    const r = validateSecretData({ name: "GitHub", secret: "INVALID01289" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("validation failed");
  });

  it("passes through Base32 warnings", () => {
    const r = validateSecretData({ name: "GitHub", secret: "JBSWY3DP" });
    expect(r.valid).toBe(true);
    expect(r.warning).toBeDefined();
    expect(r.warning).toContain("Key strength");
  });

  it("handles unicode service names", () => {
    expect(
      validateSecretData({ name: "谷歌邮箱", secret: "JBSWY3DPEHPK3PXP" }).valid
    ).toBe(true);
  });

  it("rejects extremely long names", () => {
    const r = validateSecretData({ name: "A".repeat(1000), secret: "JBSWY3DPEHPK3PXP" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("too long");
  });
});

// ── validateOTPParams ───────────────────────────────────────────────────────

describe("validateOTPParams", () => {
  it("accepts defaults", () => {
    expect(validateOTPParams({}).valid).toBe(true);
  });

  it("accepts valid TOTP params", () => {
    expect(
      validateOTPParams({ type: "TOTP", digits: 6, period: 30, algorithm: "SHA1" }).valid
    ).toBe(true);
  });

  it("accepts valid HOTP params", () => {
    expect(
      validateOTPParams({ type: "HOTP", digits: 6, counter: 0, algorithm: "SHA1" }).valid
    ).toBe(true);
  });

  it("rejects invalid OTP type", () => {
    const r = validateOTPParams({ type: "INVALID" });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("Unsupported OTP type");
  });

  it("accepts mixed-case type strings", () => {
    ["totp", "TOTP", "Totp", "hotp", "HOTP", "Hotp"].forEach((type) => {
      expect(validateOTPParams({ type }).valid).toBe(true);
    });
  });

  it("rejects invalid digit counts", () => {
    [4, 5, 7, 9, 10].forEach((digits) => {
      const r = validateOTPParams({ digits });
      expect(r.valid).toBe(false);
      expect(r.error).toContain("digit");
    });
  });

  it("accepts 6 and 8 digits", () => {
    expect(validateOTPParams({ digits: 6 }).valid).toBe(true);
    expect(validateOTPParams({ digits: 8 }).valid).toBe(true);
  });

  it("rejects invalid TOTP periods", () => {
    [15, 45, 90, 240].forEach((period) => {
      const r = validateOTPParams({ type: "TOTP", period });
      expect(r.valid).toBe(false);
      expect(r.error).toContain("period");
    });
  });

  it("accepts valid TOTP periods", () => {
    [30, 60, 120].forEach((period) => {
      expect(validateOTPParams({ type: "TOTP", period }).valid).toBe(true);
    });
  });

  it("rejects invalid algorithms", () => {
    ["MD5", "SHA128", "INVALID"].forEach((algorithm) => {
      const r = validateOTPParams({ algorithm });
      expect(r.valid).toBe(false);
      expect(r.error).toContain("algorithm");
    });
  });

  it("accepts all supported algorithms (case-insensitive)", () => {
    ["SHA1", "SHA256", "SHA512", "sha1", "sha256", "sha512"].forEach((algorithm) => {
      expect(validateOTPParams({ algorithm }).valid).toBe(true);
    });
  });

  it("rejects negative HOTP counter", () => {
    const r = validateOTPParams({ type: "HOTP", counter: -1 });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("counter");
  });

  it("rejects non-integer HOTP counter", () => {
    const r = validateOTPParams({ type: "HOTP", counter: 1.5 });
    expect(r.valid).toBe(false);
    expect(r.error).toContain("counter");
  });

  it("accepts valid HOTP counters", () => {
    [0, 1, 10, 100, 1000].forEach((counter) => {
      expect(validateOTPParams({ type: "HOTP", counter }).valid).toBe(true);
    });
  });

  it("ignores counter when type is TOTP", () => {
    expect(
      validateOTPParams({ type: "TOTP", period: 30, counter: 999 }).valid
    ).toBe(true);
  });
});

// ── createSecretObject ──────────────────────────────────────────────────────

describe("createSecretObject", () => {
  it("creates a normalized secret", () => {
    const obj = createSecretObject({
      name: "GitHub",
      service: "user@example.com",
      secret: "JBSWY3DPEHPK3PXP",
    });

    expect(obj.id).toBeDefined();
    expect(obj.name).toBe("GitHub");
    expect(obj.account).toBe("user@example.com");
    expect(obj.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(obj.digits).toBe(6);
    expect(obj.period).toBe(30);
  });

  it("generates unique UUIDs", () => {
    const a = createSecretObject({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
    const b = createSecretObject({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
    expect(a.id).not.toBe(b.id);
    expect(a.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("preserves existing ID", () => {
    const obj = createSecretObject(
      { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      "existing-id-123"
    );
    expect(obj.id).toBe("existing-id-123");
    expect(obj.createdAt).toBeUndefined();
  });

  it("trims and uppercases input", () => {
    const obj = createSecretObject({
      name: "  GitHub  ",
      service: "  user@example.com  ",
      secret: "jbswy3dpehpk3pxp",
      type: "totp",
      algorithm: "sha256",
    });

    expect(obj.name).toBe("GitHub");
    expect(obj.account).toBe("user@example.com");
    expect(obj.secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("handles HOTP with counter", () => {
    const obj = createSecretObject({
      name: "Service",
      secret: "JBSWY3DPEHPK3PXP",
      type: "HOTP",
      counter: 42,
    });
    expect(obj.type).toBe("hotp");
    expect(obj.counter).toBe(42);
  });

  it("sets counter to 0 for TOTP", () => {
    const obj = createSecretObject({
      name: "Service",
      secret: "JBSWY3DPEHPK3PXP",
      type: "TOTP",
    });
    expect(obj.counter).toBe(0);
  });

  it("handles empty service field", () => {
    const obj = createSecretObject({ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" });
    expect(obj.account).toBe("");
  });

  it("converts string params to numbers", () => {
    const obj = createSecretObject({
      name: "Service",
      secret: "JBSWY3DPEHPK3PXP",
      digits: "8",
      period: "60",
    });
    expect(obj.digits).toBe(8);
    expect(typeof obj.digits).toBe("number");
    expect(obj.period).toBe(60);
  });

  it("adds createdAt for new secrets", () => {
    const obj = createSecretObject({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
    expect(obj.createdAt).toBeDefined();
    expect(new Date(obj.createdAt!).getTime()).not.toBeNaN();
  });
});

// ── sortSecretsByName ───────────────────────────────────────────────────────

describe("sortSecretsByName", () => {
  it("sorts alphabetically", () => {
    const secrets = [
      { name: "Zoom" },
      { name: "Apple" },
      { name: "Microsoft" },
      { name: "Google" },
    ];

    const sorted = sortSecretsByName(secrets);
    expect(sorted.map((s) => s.name)).toEqual([
      "Apple",
      "Google",
      "Microsoft",
      "Zoom",
    ]);
  });

  it("sorts case-insensitively", () => {
    const secrets = [
      { name: "zoom" },
      { name: "Apple" },
      { name: "MICROSOFT" },
      { name: "google" },
    ];

    const sorted = sortSecretsByName(secrets);
    expect(sorted[0].name).toBe("Apple");
    expect(sorted[1].name).toBe("google");
    expect(sorted[2].name).toBe("MICROSOFT");
    expect(sorted[3].name).toBe("zoom");
  });

  it("handles chinese names", () => {
    const secrets = [{ name: "微软" }, { name: "谷歌" }, { name: "苹果" }];
    const sorted = sortSecretsByName(secrets);
    expect(sorted.length).toBe(3);
  });

  it("handles empty array", () => {
    expect(sortSecretsByName([])).toEqual([]);
  });

  it("handles single element", () => {
    const sorted = sortSecretsByName([{ name: "GitHub" }]);
    expect(sorted.length).toBe(1);
  });

  it("returns a new array (no mutation)", () => {
    const original = [{ name: "Zoom" }, { name: "Apple" }];
    const sorted = sortSecretsByName(original);
    expect(sorted).not.toBe(original);
    expect(original[0].name).toBe("Zoom"); // unchanged
  });

  it("handles duplicate names", () => {
    const secrets = [
      { name: "GitHub", account: "user1" },
      { name: "GitHub", account: "user2" },
      { name: "Apple", account: "" },
    ];

    const sorted = sortSecretsByName(secrets);
    expect(sorted[0].name).toBe("Apple");
    expect(sorted[1].name).toBe("GitHub");
    expect(sorted[2].name).toBe("GitHub");
  });
});

// ── checkDuplicateSecret ────────────────────────────────────────────────────

describe("checkDuplicateSecret", () => {
  const secrets = [
    { name: "GitHub", account: "user@example.com", secret: "JBSWY3DPEHPK3PXP" },
    { name: "Google", account: "user@gmail.com", secret: "MFRGGZDFMZTWQ2LK" },
    { name: "GitHub", account: "admin@example.com", secret: "KRSXG5CTMVRXEZLU" },
    { name: "Microsoft", account: "", secret: "GEZDGNBVGY3TQOJQ" },
  ];

  it("detects a duplicate", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "user@example.com", "JBSWY3DPEHPK3PXP")
    ).toBe(true);
  });

  it("returns false for non-duplicate", () => {
    expect(
      checkDuplicateSecret(secrets, "Apple", "user@example.com", "NEWSECRETNEWSECR")
    ).toBe(false);
  });

  it("distinguishes same name different account", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "newuser@example.com", "JBSWY3DPEHPK3PXP")
    ).toBe(false);
  });

  it("excludes self by index (for updates)", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "user@example.com", "JBSWY3DPEHPK3PXP", 0)
    ).toBe(false);
  });

  it("detects duplicate when excluding a different index", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "user@example.com", "JBSWY3DPEHPK3PXP", 1)
    ).toBe(true);
  });

  it("handles empty account", () => {
    expect(
      checkDuplicateSecret(secrets, "Microsoft", "", "GEZDGNBVGY3TQOJQ")
    ).toBe(true);
  });

  it("handles empty array", () => {
    expect(
      checkDuplicateSecret([], "GitHub", "user@example.com", "JBSWY3DPEHPK3PXP")
    ).toBe(false);
  });

  it("name comparison is case-sensitive", () => {
    expect(
      checkDuplicateSecret(secrets, "github", "user@example.com", "JBSWY3DPEHPK3PXP")
    ).toBe(false);
  });

  it("account comparison is case-sensitive", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "USER@EXAMPLE.COM", "JBSWY3DPEHPK3PXP")
    ).toBe(false);
  });

  it("handles negative excludeIndex", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "user@example.com", "JBSWY3DPEHPK3PXP", -1)
    ).toBe(true);
  });

  it("handles out-of-range excludeIndex", () => {
    expect(
      checkDuplicateSecret(secrets, "GitHub", "user@example.com", "JBSWY3DPEHPK3PXP", 999)
    ).toBe(true);
  });
});

// ── validateBatchImport ─────────────────────────────────────────────────────

describe("validateBatchImport", () => {
  it("accepts a valid array", () => {
    expect(validateBatchImport([{ name: "Test" }]).valid).toBe(true);
  });

  it("rejects non-array", () => {
    expect(validateBatchImport("not an array").valid).toBe(false);
  });

  it("rejects empty array", () => {
    expect(validateBatchImport([]).valid).toBe(false);
  });

  it("rejects arrays exceeding limit", () => {
    const big = Array.from({ length: 101 }, (_, i) => ({ id: i }));
    const r = validateBatchImport(big);
    expect(r.valid).toBe(false);
    expect(r.error).toContain("101");
  });

  it("accepts array at the limit", () => {
    const atLimit = Array.from({ length: 100 }, (_, i) => ({ id: i }));
    expect(validateBatchImport(atLimit).valid).toBe(true);
  });
});

// ── Integration ─────────────────────────────────────────────────────────────

describe("integration: full secret creation flow", () => {
  it("validates then normalizes a new secret", () => {
    const input = {
      name: "GitHub Enterprise",
      service: "admin@company.com",
      secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
      type: "TOTP",
      digits: 6,
      period: 30,
      algorithm: "SHA256",
    };

    const dataValid = validateSecretData(input);
    expect(dataValid.valid).toBe(true);

    const paramsValid = validateOTPParams(input);
    expect(paramsValid.valid).toBe(true);

    const obj = createSecretObject(input);
    expect(obj.id).toBeDefined();
    expect(obj.name).toBe("GitHub Enterprise");
    expect(obj.account).toBe("admin@company.com");
  });

  it("validates, sorts, and detects duplicates", () => {
    const secrets = [
      createSecretObject({ name: "GitHub", secret: "JBSWY3DPEHPK3PXP" }),
      createSecretObject({ name: "Google", secret: "MFRGGZDFMZTWQ2LK" }),
      createSecretObject({ name: "Apple", secret: "KRSXG5CTMVRXEZLU" }),
    ];

    const sorted = sortSecretsByName(secrets);
    expect(sorted[0].name).toBe("Apple");

    expect(
      checkDuplicateSecret(sorted, "GitHub", "", "JBSWY3DPEHPK3PXP")
    ).toBe(true);

    expect(
      checkDuplicateSecret(sorted, "Microsoft", "", "JBSWY3DPEHPK3PXP")
    ).toBe(false);
  });
});
