/**
 * AES-GCM 256-bit encryption tests — migrated from 2fa project.
 * Preserves all round-trip, tamper-detection, and IV-randomness tests.
 */

import { describe, it, expect } from "vitest";
import {
  encryptData,
  decryptData,
  isEncrypted,
  generateEncryptionKey,
} from "@/models/encryption";

// 32-byte key → base64
const TEST_KEY = btoa(
  String.fromCharCode(...new Uint8Array(Array.from("12345678901234567890123456789012").map((c) => c.charCodeAt(0))))
);
const WRONG_KEY = btoa(
  String.fromCharCode(...new Uint8Array(Array.from("wrongkeywrongkeywrongkeywrongke").map((c) => c.charCodeAt(0))))
);

// ── isEncrypted ─────────────────────────────────────────────────────────────

describe("isEncrypted", () => {
  it("identifies encrypted data", () => {
    expect(isEncrypted("v1:eyJpdiI6...")).toBe(true);
    expect(isEncrypted("v1:randomdata")).toBe(true);
  });

  it("identifies unencrypted data", () => {
    expect(isEncrypted("[]")).toBe(false);
    expect(isEncrypted('{"key": "value"}')).toBe(false);
    expect(isEncrypted("plain text")).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });
});

// ── encryptData / decryptData ───────────────────────────────────────────────

describe("encryptData / decryptData", () => {
  it("round-trips a simple object", async () => {
    const original = { name: "Test", value: 123 };
    const encrypted = await encryptData(original, TEST_KEY);

    expect(encrypted).toBeDefined();
    expect(encrypted.startsWith("v1:")).toBe(true);

    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual(original);
  });

  it("round-trips a complex nested object", async () => {
    const original = {
      name: "Complex Test",
      nested: { array: [1, 2, 3], bool: true, null: null },
      timestamp: "2026-01-01T00:00:00Z",
    };

    const encrypted = await encryptData(original, TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual(original);
  });

  it("round-trips unicode and emoji", async () => {
    const original = {
      name: "测试密钥",
      description: "这是一个包含中文的测试数据",
      emoji: "🔐🔑✅",
    };

    const encrypted = await encryptData(original, TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual(original);
  });

  it("round-trips a large array", async () => {
    const original = Array.from({ length: 500 }, (_, i) => ({
      id: i,
      name: `Item ${i}`,
    }));

    const encrypted = await encryptData(original, TEST_KEY);
    const decrypted = await decryptData<typeof original>(encrypted, TEST_KEY);
    expect(decrypted).toEqual(original);
    expect(decrypted.length).toBe(500);
  });

  it("fails to decrypt with wrong key", async () => {
    const encrypted = await encryptData({ secret: "sensitive" }, TEST_KEY);
    await expect(decryptData(encrypted, WRONG_KEY)).rejects.toThrow();
  });

  it("rejects invalid encrypted format", async () => {
    await expect(decryptData("v1:invalid-base64", TEST_KEY)).rejects.toThrow();
    await expect(decryptData("v1:", TEST_KEY)).rejects.toThrow();
    await expect(decryptData("invalid-format", TEST_KEY)).rejects.toThrow();
  });

  it("detects tampered ciphertext (integrity check)", async () => {
    const encrypted = await encryptData({ secret: "sensitive" }, TEST_KEY);
    const parts = encrypted.split(":");
    const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -5)}XXXXX`;
    await expect(decryptData(tampered, TEST_KEY)).rejects.toThrow();
  });

  it("requires an encryption key", async () => {
    await expect(encryptData({ name: "Test" }, "")).rejects.toThrow(
      "ENCRYPTION_KEY"
    );
  });

  it("produces different ciphertext for same data (IV randomness)", async () => {
    const original = { name: "Test" };

    const encrypted1 = await encryptData(original, TEST_KEY);
    const encrypted2 = await encryptData(original, TEST_KEY);

    expect(encrypted1).not.toBe(encrypted2);

    const decrypted1 = await decryptData(encrypted1, TEST_KEY);
    const decrypted2 = await decryptData(encrypted2, TEST_KEY);
    expect(decrypted1).toEqual(original);
    expect(decrypted2).toEqual(original);
  });
});

// ── generateEncryptionKey ───────────────────────────────────────────────────

describe("generateEncryptionKey", () => {
  it("generates a valid base64 key", async () => {
    const key = await generateEncryptionKey();
    expect(typeof key).toBe("string");

    // Should decode to 32 bytes
    const decoded = atob(key);
    expect(decoded.length).toBe(32);
  });

  it("generates unique keys", async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();
    expect(key1).not.toBe(key2);
  });

  it("generated key works for encrypt/decrypt", async () => {
    const key = await generateEncryptionKey();
    const data = { test: "round-trip" };

    const encrypted = await encryptData(data, key);
    const decrypted = await decryptData(encrypted, key);
    expect(decrypted).toEqual(data);
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("handles empty object", async () => {
    const encrypted = await encryptData({}, TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual({});
  });

  it("handles special characters", async () => {
    const original = {
      symbols: '!@#$%^&*()_+-=[]{}|;:",.<>?/',
      unicode: "你好世界🌍",
      newlines: "line1\nline2\rline3\r\nline4",
      tabs: "col1\tcol2\tcol3",
    };

    const encrypted = await encryptData(original, TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual(original);
  });

  it("handles deeply nested objects", async () => {
    let deep: Record<string, unknown> = { value: "deep" };
    for (let i = 0; i < 50; i++) {
      deep = { nested: deep };
    }

    const encrypted = await encryptData(deep, TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual(deep);
  });

  it("drops undefined fields (JSON serialization)", async () => {
    const original = { defined: "value", undef: undefined };
    const encrypted = await encryptData(original, TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual({ defined: "value" });
  });

  it("handles empty array", async () => {
    const encrypted = await encryptData([], TEST_KEY);
    const decrypted = await decryptData(encrypted, TEST_KEY);
    expect(decrypted).toEqual([]);
  });

  it("rejects unsupported version prefix", async () => {
    await expect(decryptData("v2:abc:def", TEST_KEY)).rejects.toThrow(
      "Unsupported encryption version"
    );
  });
});

// ── Key Validation ──────────────────────────────────────────────────────────

describe("key validation", () => {
  it("rejects a key that is too short", async () => {
    const shortKey = btoa("shortkey");
    await expect(encryptData({ test: "data" }, shortKey)).rejects.toThrow(
      "Invalid key length"
    );
  });

  it("rejects an invalid base64 key", async () => {
    await expect(
      encryptData({ test: "data" }, "not-valid-base64!!!")
    ).rejects.toThrow();
  });
});
