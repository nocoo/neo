/**
 * Unit tests for isEmailAllowed — fail-closed whitelist.
 */

import { describe, it, expect } from "vitest";
import { isEmailAllowed } from "@/lib/auth-whitelist";

describe("isEmailAllowed", () => {
  // ── Fail-closed ──────────────────────────────────────────────────────

  it("denies when ALLOWED_EMAILS is empty string", () => {
    expect(isEmailAllowed("alice@example.com", "")).toBe(false);
  });

  it("denies when ALLOWED_EMAILS is undefined", () => {
    expect(isEmailAllowed("alice@example.com", undefined)).toBe(false);
  });

  it("denies when ALLOWED_EMAILS is whitespace only", () => {
    expect(isEmailAllowed("alice@example.com", "  ,  , ")).toBe(false);
  });

  it("denies when email is null", () => {
    expect(isEmailAllowed(null, "alice@example.com")).toBe(false);
  });

  it("denies when email is undefined", () => {
    expect(isEmailAllowed(undefined, "alice@example.com")).toBe(false);
  });

  // ── Allow listed emails ────────────────────────────────────────────

  it("allows a listed email", () => {
    expect(isEmailAllowed("alice@example.com", "alice@example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isEmailAllowed("Alice@Example.COM", "alice@example.com")).toBe(true);
  });

  it("supports multiple emails", () => {
    const list = "alice@example.com,bob@example.com";
    expect(isEmailAllowed("bob@example.com", list)).toBe(true);
  });

  it("trims whitespace from list entries", () => {
    const list = "  alice@example.com , bob@example.com  ";
    expect(isEmailAllowed("bob@example.com", list)).toBe(true);
  });

  it("denies an unlisted email", () => {
    expect(isEmailAllowed("eve@evil.com", "alice@example.com")).toBe(false);
  });

  // ── Playwright E2E scenario ──────────────────────────────────────

  it("allows e2e@test.local when ALLOWED_EMAILS includes it", () => {
    expect(isEmailAllowed("e2e@test.local", "e2e@test.local")).toBe(true);
  });

  it("denies e2e@test.local when ALLOWED_EMAILS is unset", () => {
    expect(isEmailAllowed("e2e@test.local", "")).toBe(false);
  });
});
