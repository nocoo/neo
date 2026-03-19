/**
 * Shared utility tests.
 */

import { describe, it, expect } from "vitest";
import { sha256Hex, encryptAesGcm, isEncrypted } from "../src/utils/crypto";
import { generateId } from "../src/utils/id";

describe("sha256Hex", () => {
  it("returns consistent 64-char hex hash", async () => {
    const hash = await sha256Hex("hello world");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    const hash2 = await sha256Hex("hello world");
    expect(hash).toBe(hash2);
  });

  it("returns different hash for different input", async () => {
    const hash1 = await sha256Hex("foo");
    const hash2 = await sha256Hex("bar");
    expect(hash1).not.toBe(hash2);
  });

  it("handles empty string", async () => {
    const hash = await sha256Hex("");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("encryptAesGcm", () => {
  // Generate a valid 32-byte key
  const keyBytes = new Uint8Array(32);
  crypto.getRandomValues(keyBytes);
  const testKey = btoa(String.fromCharCode(...keyBytes));

  it("returns v1: format", async () => {
    const encrypted = await encryptAesGcm("test data", testKey);
    expect(encrypted).toMatch(/^v1:.+:.+$/);
  });

  it("produces different output each time (random IV)", async () => {
    const e1 = await encryptAesGcm("same input", testKey);
    const e2 = await encryptAesGcm("same input", testKey);
    expect(e1).not.toBe(e2);
  });
});

describe("isEncrypted", () => {
  it("detects v1: format", () => {
    expect(isEncrypted("v1:abc:def")).toBe(true);
  });

  it("returns false for plain JSON", () => {
    expect(isEncrypted('{"data": "test"}')).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEncrypted("")).toBe(false);
  });
});

describe("generateId", () => {
  it("generates ID with prefix", () => {
    const id = generateId("bk");
    expect(id).toMatch(/^bk_[a-z0-9]+_[a-z0-9]+$/);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId("test")));
    expect(ids.size).toBe(100);
  });

  it("uses default prefix", () => {
    const id = generateId();
    expect(id).toMatch(/^id_/);
  });
});
