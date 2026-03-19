/**
 * OTP generation tests — migrated from 2fa project.
 * Preserves ALL RFC 6238/4226 official test vectors.
 */

import { describe, it, expect } from "vitest";
import {
  generateOTP,
  generateTOTP,
  generateOTPAuthURL,
  base32toByteArray,
  byteArrayToBase32,
  getHashAlgorithm,
} from "@/models/otp";

// ── base32toByteArray ────────────────────────────────────────────────────────

describe("base32toByteArray", () => {
  it("decodes RFC 4648 test vectors correctly", () => {
    const testCases = [
      {
        input: "JBSWY3DPEHPK3PXP",
        expected: [72, 101, 108, 108, 111, 33, 222, 173, 190, 239],
      },
      {
        input: "MFRGGZDFMZTWQ2LK",
        expected: [97, 98, 99, 100, 101, 102, 103, 104, 105, 106],
      },
      {
        input: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",
        expected: [
          49, 50, 51, 52, 53, 54, 55, 56, 57, 48, 49, 50, 51, 52, 53, 54, 55,
          56, 57, 48,
        ],
      },
    ];

    testCases.forEach(({ input, expected }) => {
      const result = base32toByteArray(input);
      expect(Array.from(result)).toEqual(expected);
    });
  });

  it("handles padding characters", () => {
    const input = "JBSWY3DPEHPK3PXP====";
    const result = base32toByteArray(input);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles lowercase input", () => {
    const input = "jbswy3dpehpk3pxp";
    const result = base32toByteArray(input);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it("rejects invalid Base32 characters", () => {
    const invalidInputs = ["INVALID1", "TEST@#$%", "12345678"];
    invalidInputs.forEach((input) => {
      expect(() => base32toByteArray(input)).toThrow();
    });
  });
});

// ── byteArrayToBase32 ────────────────────────────────────────────────────────

describe("byteArrayToBase32", () => {
  it("round-trips with base32toByteArray", () => {
    const original = "JBSWY3DPEHPK3PXP";
    const bytes = base32toByteArray(original);
    const result = byteArrayToBase32(bytes);
    expect(result).toBe(original);
  });
});

// ── getHashAlgorithm ─────────────────────────────────────────────────────────

describe("getHashAlgorithm", () => {
  it("returns correct Web Crypto algorithm names", () => {
    expect(getHashAlgorithm("SHA1")).toBe("SHA-1");
    expect(getHashAlgorithm("SHA256")).toBe("SHA-256");
    expect(getHashAlgorithm("SHA512")).toBe("SHA-512");
    expect(getHashAlgorithm("SHA-1")).toBe("SHA-1");
    expect(getHashAlgorithm("SHA-256")).toBe("SHA-256");
    expect(getHashAlgorithm("SHA-512")).toBe("SHA-512");
  });

  it("defaults to SHA-1 for unknown algorithms", () => {
    expect(getHashAlgorithm("UNKNOWN")).toBe("SHA-1");
    expect(getHashAlgorithm("")).toBe("SHA-1");
  });
});

// ── TOTP — RFC 6238 SHA-1 Test Vectors ───────────────────────────────────────

describe("TOTP - RFC 6238 SHA-1 test vectors", () => {
  // RFC 6238 Appendix B: Key = "12345678901234567890" (ASCII)
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  const testVectors = [
    { time: 59, expected: "94287082", digits: 8, description: "1970-01-01 00:00:59" },
    { time: 1111111109, expected: "07081804", digits: 8, description: "2005-03-18 01:58:29" },
    { time: 1111111111, expected: "14050471", digits: 8, description: "2005-03-18 01:58:31" },
    { time: 1234567890, expected: "89005924", digits: 8, description: "2009-02-13 23:31:30" },
    { time: 2000000000, expected: "69279037", digits: 8, description: "2033-05-18 03:33:20" },
    { time: 20000000000, expected: "65353130", digits: 8, description: "2603-10-11 11:33:20" },
  ];

  testVectors.forEach(({ time, expected, digits, description }) => {
    it(`generates correct TOTP for time ${time} (${description}): ${expected}`, async () => {
      const otp = await generateOTP(secret, time, {
        digits,
        period: 30,
        algorithm: "SHA1",
        type: "TOTP",
      });
      expect(otp).toBe(expected);
    });
  });
});

// ── TOTP — RFC 6238 SHA-256 Test Vectors ─────────────────────────────────────

describe("TOTP - RFC 6238 SHA-256 test vectors", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA"; // 32 bytes

  const testVectors = [
    { time: 59, expected: "46119246", digits: 8 },
    { time: 1111111109, expected: "68084774", digits: 8 },
    { time: 1111111111, expected: "67062674", digits: 8 },
    { time: 1234567890, expected: "91819424", digits: 8 },
    { time: 2000000000, expected: "90698825", digits: 8 },
    { time: 20000000000, expected: "77737706", digits: 8 },
  ];

  testVectors.forEach(({ time, expected, digits }) => {
    it(`generates correct SHA-256 TOTP for time ${time}: ${expected}`, async () => {
      const otp = await generateOTP(secret, time, {
        digits,
        period: 30,
        algorithm: "SHA256",
        type: "TOTP",
      });
      expect(otp).toBe(expected);
    });
  });
});

// ── TOTP — RFC 6238 SHA-512 Test Vectors ─────────────────────────────────────

describe("TOTP - RFC 6238 SHA-512 test vectors", () => {
  const secret =
    "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA"; // 64 bytes

  const testVectors = [
    { time: 59, expected: "90693936", digits: 8 },
    { time: 1111111109, expected: "25091201", digits: 8 },
    { time: 1111111111, expected: "99943326", digits: 8 },
    { time: 1234567890, expected: "93441116", digits: 8 },
    { time: 2000000000, expected: "38618901", digits: 8 },
    { time: 20000000000, expected: "47863826", digits: 8 },
  ];

  testVectors.forEach(({ time, expected, digits }) => {
    it(`generates correct SHA-512 TOTP for time ${time}: ${expected}`, async () => {
      const otp = await generateOTP(secret, time, {
        digits,
        period: 30,
        algorithm: "SHA512",
        type: "TOTP",
      });
      expect(otp).toBe(expected);
    });
  });
});

// ── HOTP — RFC 4226 Test Vectors ─────────────────────────────────────────────

describe("HOTP - RFC 4226 test vectors", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

  const testVectors = [
    { counter: 0, expected: "755224" },
    { counter: 1, expected: "287082" },
    { counter: 2, expected: "359152" },
    { counter: 3, expected: "969429" },
    { counter: 4, expected: "338314" },
    { counter: 5, expected: "254676" },
    { counter: 6, expected: "287922" },
    { counter: 7, expected: "162583" },
    { counter: 8, expected: "399871" },
    { counter: 9, expected: "520489" },
  ];

  testVectors.forEach(({ counter, expected }) => {
    it(`generates correct HOTP for counter ${counter}: ${expected}`, async () => {
      const otp = await generateOTP(secret, 0, {
        digits: 6,
        type: "HOTP",
        counter,
        algorithm: "SHA1",
      });
      expect(otp).toBe(expected);
    });
  });
});

// ── TOTP Default Parameters ──────────────────────────────────────────────────

describe("TOTP default parameters", () => {
  it("generates 6-digit TOTP with defaults", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const time = Math.floor(Date.now() / 1000);
    const otp = await generateOTP(secret, time, {});
    expect(otp).toMatch(/^\d{6}$/);
    expect(otp.length).toBe(6);
  });

  it("generates different OTPs for different time windows", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const time1 = 1000000000;
    const time2 = 1000000030; // next 30s window
    const otp1 = await generateOTP(secret, time1, { period: 30 });
    const otp2 = await generateOTP(secret, time2, { period: 30 });
    expect(otp1).not.toBe(otp2);
  });

  it("generates same OTP within same time window", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const time1 = 1000000000;
    const time2 = 1000000010; // same 30s window
    const otp1 = await generateOTP(secret, time1, { period: 30 });
    const otp2 = await generateOTP(secret, time2, { period: 30 });
    expect(otp1).toBe(otp2);
  });

  it("supports 8-digit OTP", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const otp = await generateOTP(secret, 1000000000, { digits: 8 });
    expect(otp).toMatch(/^\d{8}$/);
  });

  it("supports custom period", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const otp60 = await generateOTP(secret, 1000000000, { period: 60 });
    const otp30 = await generateOTP(secret, 1000000000, { period: 30 });
    // Different periods -> likely different OTPs (not guaranteed but very likely)
    expect(otp60).toBeDefined();
    expect(otp30).toBeDefined();
  });

  it("pads OTPs with leading zeros", async () => {
    // RFC 6238 time 1111111109 SHA-1 produces 07081804 (leading zero)
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const otp = await generateOTP(secret, 1111111109, {
      digits: 8,
      algorithm: "SHA1",
    });
    expect(otp).toBe("07081804");
    expect(otp[0]).toBe("0");
  });

  it("is deterministic", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const time = 1000000000;
    const otp1 = await generateOTP(secret, time);
    const otp2 = await generateOTP(secret, time);
    expect(otp1).toBe(otp2);
  });

  it("produces different results for different algorithms", async () => {
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const time = 59;
    const sha1 = await generateOTP(secret, time, { digits: 8, algorithm: "SHA1" });
    const sha256 = await generateOTP(secret, time, { digits: 8, algorithm: "SHA256" });
    expect(sha1).not.toBe(sha256);
  });
});

// ── generateTOTP (client preview) ────────────────────────────────────────────

describe("generateTOTP (client preview)", () => {
  it("generates 6-digit OTP", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const counter = Math.floor(Date.now() / 30000);
    const otp = await generateTOTP(secret, counter);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("generates 8-digit OTP", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const counter = Math.floor(Date.now() / 30000);
    const otp = await generateTOTP(secret, counter, { digits: 8 });
    expect(otp).toMatch(/^\d{8}$/);
  });

  it("supports SHA-256", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const otp = await generateTOTP(secret, 1000, { algorithm: "SHA256" });
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("supports SHA-512", async () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const otp = await generateTOTP(secret, 1000, { algorithm: "SHA512" });
    expect(otp).toMatch(/^\d{6}$/);
  });

  it("returns placeholder on invalid secret", async () => {
    const otp = await generateTOTP("INVALID!@#", 1000);
    expect(otp).toBe("------");
  });

  it("returns correct length placeholder on failure", async () => {
    const otp = await generateTOTP("INVALID!@#", 1000, { digits: 8 });
    expect(otp).toBe("--------");
  });
});

// ── generateOTPAuthURL ───────────────────────────────────────────────────────

describe("generateOTPAuthURL", () => {
  it("generates TOTP URL with default params", () => {
    const url = generateOTPAuthURL("GitHub", "user@example.com", "JBSWY3DPEHPK3PXP");
    expect(url).toContain("otpauth://totp/");
    expect(url).toContain("secret=JBSWY3DPEHPK3PXP");
    expect(url).toContain("issuer=GitHub");
    expect(url).toContain("digits=6");
    expect(url).toContain("period=30");
  });

  it("generates HOTP URL", () => {
    const url = generateOTPAuthURL("Service", "user", "SECRET", {
      type: "HOTP",
      counter: 5,
    });
    expect(url).toContain("otpauth://hotp/");
    expect(url).toContain("counter=5");
    expect(url).not.toContain("period=");
  });

  it("URL-encodes special characters", () => {
    const url = generateOTPAuthURL("My Service", "user@test.com", "AABBCC");
    expect(url).toContain(encodeURIComponent("My Service:user@test.com"));
  });

  it("handles custom parameters", () => {
    const url = generateOTPAuthURL("Test", "acc", "SECRET", {
      digits: 8,
      period: 60,
      algorithm: "SHA256",
    });
    expect(url).toContain("digits=8");
    expect(url).toContain("period=60");
    expect(url).toContain("algorithm=SHA256");
  });

  it("uppercases secret in URL", () => {
    const url = generateOTPAuthURL("Test", "", "abcdef");
    expect(url).toContain("secret=ABCDEF");
  });
});
