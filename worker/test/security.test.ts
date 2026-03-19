/**
 * Security headers tests.
 */

import { describe, it, expect } from "vitest";
import {
  isOriginAllowed,
  getAllowedOrigin,
  getSecurityHeaders,
  createPreflightResponse,
} from "../src/security";

function makeRequest(
  origin: string | null,
  host: string = "example.com"
): Request {
  const headers: Record<string, string> = { host };
  if (origin) headers["origin"] = origin;
  return new Request("https://example.com/", { headers });
}

describe("isOriginAllowed", () => {
  it("allows same-origin HTTPS", () => {
    const req = makeRequest("https://example.com", "example.com");
    expect(isOriginAllowed("https://example.com", req)).toBe(true);
  });

  it("allows same-origin HTTP", () => {
    const req = makeRequest("http://example.com", "example.com");
    expect(isOriginAllowed("http://example.com", req)).toBe(true);
  });

  it("rejects cross-origin", () => {
    const req = makeRequest("https://evil.com", "example.com");
    expect(isOriginAllowed("https://evil.com", req)).toBe(false);
  });

  it("rejects empty origin", () => {
    const req = makeRequest(null);
    expect(isOriginAllowed("", req)).toBe(false);
  });

  it("allows localhost cross-port for dev", () => {
    const req = makeRequest("http://localhost:3000", "localhost:8787");
    expect(isOriginAllowed("http://localhost:3000", req)).toBe(true);
  });

  it("allows 127.0.0.1 cross-port for dev", () => {
    const req = makeRequest("http://127.0.0.1:3000", "127.0.0.1:8787");
    expect(isOriginAllowed("http://127.0.0.1:3000", req)).toBe(true);
  });
});

describe("getAllowedOrigin", () => {
  it("returns origin when allowed", () => {
    const req = makeRequest("https://example.com", "example.com");
    expect(getAllowedOrigin(req)).toBe("https://example.com");
  });

  it("returns null when not allowed", () => {
    const req = makeRequest("https://evil.com", "example.com");
    expect(getAllowedOrigin(req)).toBeNull();
  });

  it("returns null when no origin header", () => {
    const req = makeRequest(null);
    expect(getAllowedOrigin(req)).toBeNull();
  });
});

describe("getSecurityHeaders", () => {
  it("includes standard security headers", () => {
    const req = makeRequest(null);
    const headers = getSecurityHeaders(req);
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("includes CSP by default", () => {
    const req = makeRequest(null);
    const headers = getSecurityHeaders(req);
    expect(headers["Content-Security-Policy"]).toBeDefined();
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
  });

  it("includes CORS when origin is allowed", () => {
    const req = makeRequest("https://example.com", "example.com");
    const headers = getSecurityHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://example.com");
    expect(headers["Vary"]).toBe("Origin");
  });

  it("omits CORS when origin is not allowed", () => {
    const req = makeRequest("https://evil.com", "example.com");
    const headers = getSecurityHeaders(req);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("can exclude CSP", () => {
    const req = makeRequest(null);
    const headers = getSecurityHeaders(req, { includeCSP: false });
    expect(headers["Content-Security-Policy"]).toBeUndefined();
  });
});

describe("createPreflightResponse", () => {
  it("returns 204 for valid origin", () => {
    const req = makeRequest("https://example.com", "example.com");
    const response = createPreflightResponse(req);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
    expect(response.headers.get("Access-Control-Max-Age")).toBe("86400");
  });

  it("returns 403 for invalid origin", () => {
    const req = makeRequest("https://evil.com", "example.com");
    const response = createPreflightResponse(req);
    expect(response.status).toBe(403);
  });

  it("returns 403 for missing origin", () => {
    const req = makeRequest(null);
    const response = createPreflightResponse(req);
    expect(response.status).toBe(403);
  });
});
