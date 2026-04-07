/**
 * OTP endpoint tests.
 */

import { describe, it, expect } from "vitest";
import { handleOtp, type OtpRequest } from "../src/otp";
import type { Env } from "../src/types";

const mockEnv = {} as Env;

describe("handleOtp", () => {
  it("returns valid OTP for valid secret", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", format: "json" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);

    const data = await response.json() as Record<string, unknown>;
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
    const data = await response.json() as Record<string, unknown>;
    expect((data.otp as string).length).toBe(8);
  });

  it("supports SHA256 algorithm", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", algorithm: "SHA256", format: "json" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
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
    const data = await response.json() as Record<string, unknown>;
    expect(data.remaining).toBeDefined();
    expect(typeof data.remaining).toBe("number");
    expect(data.remaining as number).toBeGreaterThan(0);
    expect(data.remaining as number).toBeLessThanOrEqual(30);
  });

  it("supports HOTP with counter", async () => {
    const body: OtpRequest = { secret: "JBSWY3DPEHPK3PXP", type: "HOTP", counter: 5, format: "json" };
    const response = await handleOtp(body, mockEnv);
    expect(response.status).toBe(200);
    const data = await response.json() as Record<string, unknown>;
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
    const data = await response.json() as Record<string, unknown>;
    expect(data.hint).toContain("POST /otp");
  });
});
