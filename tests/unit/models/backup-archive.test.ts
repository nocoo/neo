/**
 * Backup archive model tests.
 * Covers round-trip encrypt/decrypt, wrong key rejection,
 * tampered manifest detection, format validation, edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  createEncryptedZip,
  openEncryptedZip,
  validateManifest,
  generateArchiveFilename,
  MAX_ARCHIVE_UPLOAD_BYTES,
  MAX_ARCHIVE_SECRETS,
} from "@/models/backup-archive";
import type { BackupManifest } from "@/models/backup-archive";
import { generateEncryptionKey } from "@/models/encryption";
import type { ParsedSecret } from "@/models/types";

// ── Test Data ────────────────────────────────────────────────────────────────

const SAMPLE_SECRETS: ParsedSecret[] = [
  {
    name: "GitHub",
    account: "user@github.com",
    secret: "JBSWY3DPEHPK3PXP",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
  {
    name: "Google",
    account: "user@gmail.com",
    secret: "HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
];

const HOTP_SECRET: ParsedSecret = {
  name: "AWS",
  account: "admin@aws.com",
  secret: "KRMVATZTJFZUC53FONXW2ZJB",
  type: "hotp",
  digits: 8,
  period: 0,
  algorithm: "SHA-256",
  counter: 42,
};

// ── Round-trip Tests ─────────────────────────────────────────────────────────

describe("round-trip: create → restore", () => {
  it("encrypts and decrypts secrets with correct key", async () => {
    const key = await generateEncryptionKey();

    const zipBytes = await createEncryptedZip(SAMPLE_SECRETS, key);
    expect(zipBytes.length).toBeGreaterThan(0);
    expect(zipBytes).toBeInstanceOf(Uint8Array);

    const restored = await openEncryptedZip(zipBytes, key);
    expect(restored).toHaveLength(2);
    expect(restored[0]!.name).toBe("GitHub");
    expect(restored[0]!.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(restored[0]!.account).toBe("user@github.com");
    expect(restored[1]!.name).toBe("Google");
    expect(restored[1]!.secret).toBe("HXDMVJECJJWSRB3HWIZR4IFUGFTMXBOZ");
  });

  it("preserves all secret fields through round-trip", async () => {
    const key = await generateEncryptionKey();
    const secrets = [...SAMPLE_SECRETS, HOTP_SECRET];

    const zipBytes = await createEncryptedZip(secrets, key);
    const restored = await openEncryptedZip(zipBytes, key);

    expect(restored).toHaveLength(3);

    // Verify HOTP secret fields preserved
    const hotp = restored.find((s) => s.name === "AWS");
    expect(hotp).toBeDefined();
    expect(hotp!.type).toBe("hotp");
    expect(hotp!.digits).toBe(8);
    expect(hotp!.algorithm).toBe("SHA-256");
    expect(hotp!.counter).toBe(42);
    expect(hotp!.period).toBe(0);
  });

  it("handles empty secrets array", async () => {
    const key = await generateEncryptionKey();

    const zipBytes = await createEncryptedZip([], key);
    expect(zipBytes.length).toBeGreaterThan(0);

    const restored = await openEncryptedZip(zipBytes, key);
    expect(restored).toHaveLength(0);
  });

  it("handles single secret", async () => {
    const key = await generateEncryptionKey();

    const zipBytes = await createEncryptedZip([SAMPLE_SECRETS[0]!], key);
    const restored = await openEncryptedZip(zipBytes, key);

    expect(restored).toHaveLength(1);
    expect(restored[0]!.name).toBe("GitHub");
  });

  it("handles large payload (100 secrets)", async () => {
    const key = await generateEncryptionKey();
    const manySecrets: ParsedSecret[] = Array.from({ length: 100 }, (_, i) => ({
      name: `Service ${i}`,
      account: `user${i}@example.com`,
      secret: "JBSWY3DPEHPK3PXP",
      type: "totp" as const,
      digits: 6,
      period: 30,
      algorithm: "SHA-1" as const,
      counter: 0,
    }));

    const zipBytes = await createEncryptedZip(manySecrets, key);
    const restored = await openEncryptedZip(zipBytes, key);

    expect(restored).toHaveLength(100);
    expect(restored[0]!.name).toBe("Service 0");
    expect(restored[99]!.name).toBe("Service 99");
  });
});

// ── Wrong Key Tests ──────────────────────────────────────────────────────────

describe("wrong key rejection", () => {
  it("rejects wrong decryption key", async () => {
    const key1 = await generateEncryptionKey();
    const key2 = await generateEncryptionKey();

    const zipBytes = await createEncryptedZip(SAMPLE_SECRETS, key1);

    await expect(openEncryptedZip(zipBytes, key2)).rejects.toThrow();
  });

  it("rejects empty key", async () => {
    const key = await generateEncryptionKey();
    const zipBytes = await createEncryptedZip(SAMPLE_SECRETS, key);

    await expect(openEncryptedZip(zipBytes, "")).rejects.toThrow();
  });
});

// ── Archive Format Validation ────────────────────────────────────────────────

describe("archive format validation", () => {
  it("rejects empty Uint8Array", () => {
    const key = "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTE="; // dummy
    expect(openEncryptedZip(new Uint8Array(0), key)).rejects.toThrow();
  });

  it("rejects garbage data", () => {
    const key = "dGVzdGtleXRlc3RrZXl0ZXN0a2V5dGVzdGtleTE=";
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    expect(openEncryptedZip(garbage, key)).rejects.toThrow();
  });
});

// ── Manifest Validation ──────────────────────────────────────────────────────

describe("validateManifest", () => {
  const validManifest: BackupManifest = {
    version: 2,
    format: "neo-encrypted-backup",
    createdAt: new Date().toISOString(),
    secretCount: 5,
    encryption: {
      algorithm: "AES-GCM-256",
      ivEncoding: "base64",
      tagLength: 128,
    },
  };

  it("accepts valid manifest", () => {
    expect(() => validateManifest(validManifest)).not.toThrow();
  });

  it("rejects wrong format", () => {
    expect(() =>
      validateManifest({ ...validManifest, format: "unknown-format" }),
    ).toThrow(/unexpected format/);
  });

  it("rejects wrong version", () => {
    expect(() =>
      validateManifest({ ...validManifest, version: 99 }),
    ).toThrow(/unsupported version/);
  });

  it("rejects negative secretCount", () => {
    expect(() =>
      validateManifest({ ...validManifest, secretCount: -1 }),
    ).toThrow(/secretCount/);
  });

  it("rejects wrong encryption algorithm", () => {
    expect(() =>
      validateManifest({
        ...validManifest,
        encryption: { ...validManifest.encryption, algorithm: "DES" },
      }),
    ).toThrow(/unsupported encryption/);
  });

  it("rejects null manifest", () => {
    expect(() =>
      validateManifest(null as unknown as BackupManifest),
    ).toThrow(/null or undefined/);
  });
});

// ── Filename Generation ──────────────────────────────────────────────────────

describe("generateArchiveFilename", () => {
  it("generates correct format", () => {
    const date = new Date("2026-03-20T10:30:00Z");
    expect(generateArchiveFilename(date)).toBe("neo-backup-2026-03-20.zip");
  });

  it("pads month and day", () => {
    const date = new Date("2026-01-05T00:00:00Z");
    expect(generateArchiveFilename(date)).toBe("neo-backup-2026-01-05.zip");
  });

  it("uses current date when no argument", () => {
    const filename = generateArchiveFilename();
    expect(filename).toMatch(/^neo-backup-\d{4}-\d{2}-\d{2}\.zip$/);
  });
});

// ── Safety Limits ─────────────────────────────────────────────────────────────

describe("safety limits", () => {
  it("rejects ZIP exceeding upload size limit", async () => {
    const key = await generateEncryptionKey();
    // Create a fake oversized Uint8Array (just needs to exceed the limit)
    const oversized = new Uint8Array(MAX_ARCHIVE_UPLOAD_BYTES + 1);
    await expect(openEncryptedZip(oversized, key)).rejects.toThrow(
      /Archive too large/,
    );
  });

  it("exports MAX_ARCHIVE_UPLOAD_BYTES constant", () => {
    expect(MAX_ARCHIVE_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  it("exports MAX_ARCHIVE_SECRETS constant", () => {
    expect(MAX_ARCHIVE_SECRETS).toBe(10_000);
  });
});
