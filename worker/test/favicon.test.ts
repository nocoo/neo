/**
 * Favicon proxy tests.
 */

import { describe, it, expect } from "vitest";
import { isValidDomain } from "../src/favicon";

// Note: handleFavicon requires network access, so we only test validation
// and leave integration testing to E2E.
//
// Security: Direct fetches (https://domain/favicon.ico) have been removed.
// Only trusted third-party services (Google, Yandex, DuckDuckGo) are used,
// which eliminates SSRF via DNS rebinding attacks.

describe("isValidDomain", () => {
  it("accepts valid domains", () => {
    expect(isValidDomain("github.com")).toBe(true);
    expect(isValidDomain("www.google.com")).toBe(true);
    expect(isValidDomain("sub.domain.example.org")).toBe(true);
    expect(isValidDomain("a.co")).toBe(true);
  });

  it("rejects empty/null", () => {
    expect(isValidDomain("")).toBe(false);
  });

  it("rejects domains over 253 chars", () => {
    expect(isValidDomain("a".repeat(254))).toBe(false);
  });

  it("rejects domains with double dots", () => {
    expect(isValidDomain("example..com")).toBe(false);
  });

  it("rejects domains with slashes", () => {
    expect(isValidDomain("example//com")).toBe(false);
  });

  it("rejects domains with @", () => {
    expect(isValidDomain("user@example.com")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(isValidDomain("exam ple.com")).toBe(false);
    expect(isValidDomain("example$.com")).toBe(false);
  });
});
