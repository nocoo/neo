/**
 * Protocol handler tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  PROTOCOL,
  HANDLER_URL,
  isProtocolHandlerSupported,
  registerProtocolHandler,
  parseOtpauthParam,
} from "@/lib/protocol-handler";

// ── Setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────────

describe("protocol-handler", () => {
  // ── Constants ────────────────────────────────────────────────────────

  it("exports correct protocol", () => {
    expect(PROTOCOL).toBe("web+otpauth");
  });

  it("exports correct handler URL", () => {
    expect(HANDLER_URL).toBe("/dashboard?otpauth=%s");
  });

  // ── isProtocolHandlerSupported ───────────────────────────────────────

  it("returns true when registerProtocolHandler exists", () => {
    vi.stubGlobal("navigator", {
      registerProtocolHandler: vi.fn(),
    });
    expect(isProtocolHandlerSupported()).toBe(true);
  });

  it("returns false when navigator is undefined", () => {
    vi.stubGlobal("navigator", undefined);
    expect(isProtocolHandlerSupported()).toBe(false);
  });

  // ── registerProtocolHandler ──────────────────────────────────────────

  it("calls navigator.registerProtocolHandler with correct args", () => {
    const mockRegister = vi.fn();
    vi.stubGlobal("navigator", {
      registerProtocolHandler: mockRegister,
    });

    const result = registerProtocolHandler();
    expect(result).toBe(true);
    expect(mockRegister).toHaveBeenCalledWith(PROTOCOL, HANDLER_URL);
  });

  it("returns false when API is not supported", () => {
    vi.stubGlobal("navigator", {});
    expect(registerProtocolHandler()).toBe(false);
  });

  it("returns false when registration throws", () => {
    vi.stubGlobal("navigator", {
      registerProtocolHandler: vi.fn().mockImplementation(() => {
        throw new Error("SecurityError");
      }),
    });
    expect(registerProtocolHandler()).toBe(false);
  });

  // ── parseOtpauthParam ────────────────────────────────────────────────

  it("parses web+otpauth URI from search params", () => {
    const params = new URLSearchParams(
      "otpauth=web%2Botpauth%3A%2F%2Ftotp%2FExample%3Fsecret%3DJBSWY3DPEHPK3PXP"
    );
    const result = parseOtpauthParam(params);
    expect(result).toBe("otpauth://totp/Example?secret=JBSWY3DPEHPK3PXP");
  });

  it("returns null when otpauth param is missing", () => {
    const params = new URLSearchParams("foo=bar");
    expect(parseOtpauthParam(params)).toBeNull();
  });

  it("returns null for invalid URI (not otpauth://)", () => {
    const params = new URLSearchParams("otpauth=https://example.com");
    expect(parseOtpauthParam(params)).toBeNull();
  });

  it("passes through standard otpauth:// URIs", () => {
    const params = new URLSearchParams(
      "otpauth=otpauth%3A%2F%2Fhotp%2FTest%3Fsecret%3DABC%26counter%3D0"
    );
    const result = parseOtpauthParam(params);
    expect(result).toBe("otpauth://hotp/Test?secret=ABC&counter=0");
  });
});
