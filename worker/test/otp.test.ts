/**
 * OTP endpoint tests.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { handleOtp, type OtpRequest } from "../src/otp";
import type { Env } from "../src/types";

const mockEnv = {} as Env;
const rfcSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("handleOtp", () => {
  it("returns valid OTP for valid secret", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", format: "json" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);

    const data = (await response.json()) as Record<string, unknown>;
    expect(data.otp).toBeDefined();
    expect(typeof data.otp).toBe("string");
    expect((data.otp as string).length).toBe(6);
  });

  it("returns 400 for invalid secret", async () => {
    const body: OtpRequest = { secret: "INVALID!@#" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("returns 400 for empty secret", async () => {
    const body: OtpRequest = { secret: "" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("supports 8-digit OTP", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", digits: 8, format: "json" };
    const response = await handleOtp(body, mockEnv);
    const data = (await response.json()) as Record<string, unknown>;
    expect((data.otp as string).length).toBe(8);
  });

  it("supports SHA256 algorithm", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", algorithm: "SHA256", format: "json" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.algorithm).toBe("SHA256");
  });

  it("supports text format", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", format: "text" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toMatch(/^\d{6}$/);
  });

  it("rejects invalid type", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", type: "INVALID" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("rejects invalid digits", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", digits: 7 };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("rejects invalid period", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", period: 45 };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("rejects invalid algorithm", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", algorithm: "MD5" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("includes remaining seconds in response", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", format: "json" };
    const response = await handleOtp(body, mockEnv);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.remaining).toBeDefined();
    expect(typeof data.remaining).toBe("number");
    expect(data.remaining as number).toBeGreaterThan(0);
    expect(data.remaining as number).toBeLessThanOrEqual(30);
  });

  it("supports HOTP with counter", async () => {
    const body: OtpRequest = {
      secret: "JBSWY3DPEHPK3PXP",
      type: "HOTP",
      counter: 5,
      format: "json",
    };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.type).toBe("HOTP");
  });

  it("rejects short secret", async () => {
    const body: OtpRequest = { secret: "ABC" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(400);
  });

  it("includes hint for invalid secret", async () => {
    const body: OtpRequest = { secret: "" };
    const response = await handleOtp(body, mockEnv);
    const data = (await response.json()) as Record<string, unknown>;
    expect(data.hint).toContain("POST /otp");
  });
});

describe("public OTP protocol contracts", () => {
  it.each([
    ["SHA1", rfcSecret, "94287082"],
    ["SHA256", "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA====", "46119246"],
    [
      "SHA512",
      "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNA=",
      "90693936",
    ],
  ])("matches the RFC 6238 %s vector at 59 seconds", async (algorithm, secret, otp) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(59_000));
    const response = await handleOtp({ secret, algorithm, digits: 8 }, mockEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      otp,
      type: "TOTP",
      algorithm,
      digits: 8,
      period: 30,
      remaining: 1,
    });
  });

  it.each([
    [0, "755224"],
    [1, "287082"],
    [2, "359152"],
  ])("matches the RFC 4226 HOTP counter %i vector", async (counter, otp) => {
    const response = await handleOtp({ secret: rfcSecret, type: "hotp", counter }, mockEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ otp, type: "HOTP", digits: 6 });
  });

  it("normalizes accepted grouped, lowercase and padded Base32 consistently", async () => {
    const secret = `${rfcSecret.toLowerCase().replace(/(.{4})/g, "$1 ")}====`;
    const response = await handleOtp({ secret, type: "HOTP" }, mockEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ otp: "755224", type: "HOTP" });
  });

  it.each([30, 60, 120])("preserves TOTP epoch-zero behavior for period %i", async (period) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const response = await handleOtp({ secret: rfcSecret, period }, mockEnv);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ otp: "755224", period, remaining: period });
  });

  it("returns an error instead of an OTP when crypto rejects an operation", async () => {
    vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce(new Error("test crypto failure"));
    const response = await handleOtp({ secret: rfcSecret }, mockEnv);
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data).toEqual({ error: "OTP generation failed", detail: "test crypto failure" });
    expect(JSON.stringify(data)).not.toContain(rfcSecret);
  });

  it("does not expose a non-Error crypto failure value", async () => {
    vi.spyOn(crypto.subtle, "importKey").mockRejectedValueOnce("private backend detail");
    const response = await handleOtp({ secret: rfcSecret }, mockEnv);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "OTP generation failed",
      detail: "Unknown error",
    });
  });

  it("rejects an empty crypto result rather than generating a token", async () => {
    vi.spyOn(crypto.subtle, "sign").mockResolvedValueOnce(new ArrayBuffer(0));
    const response = await handleOtp({ secret: rfcSecret }, mockEnv);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "OTP generation failed",
      detail: "HMAC output was empty",
    });
  });
});
