/**
 * Router tests.
 */

import { describe, it, expect } from "vitest";
import { handleRequest } from "../src/router";
import type { Env } from "../src/types";

const mockEnv = {} as Env;

function makeRequest(path: string, method = "GET", host = "localhost:8787"): Request {
  return new Request(`http://${host}${path}`, {
    method,
    headers: { host },
  });
}

describe("handleRequest", () => {
  it("routes /otp/:secret to OTP handler", async () => {
    const req = makeRequest("/otp/JBSWY3DPEHPK3PXP?format=json");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.otp).toBeDefined();
  });

  it("returns 404 for unknown paths", async () => {
    const req = makeRequest("/unknown");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(404);
  });

  it("handles health check", async () => {
    const req = makeRequest("/health");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.status).toBe("ok");
  });

  it("handles OPTIONS preflight", async () => {
    const req = new Request("http://localhost:8787/otp/test", {
      method: "OPTIONS",
      headers: {
        host: "localhost:8787",
        origin: "http://localhost:3000",
      },
    });
    const res = await handleRequest(req, mockEnv);
    // localhost cross-port is allowed
    expect(res.status).toBe(204);
  });

  it("includes security headers in responses", async () => {
    const req = makeRequest("/health");
    const res = await handleRequest(req, mockEnv);
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("returns 400 for invalid OTP secret", async () => {
    const req = makeRequest("/otp/INVALID!@#");
    const res = await handleRequest(req, mockEnv);
    expect(res.status).toBe(400);
  });
});
