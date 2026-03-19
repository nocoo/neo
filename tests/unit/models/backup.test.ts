/**
 * Backup model tests.
 * Covers filename generation, hash computation, serialization,
 * deserialization, debounce, and retention logic.
 */

import { describe, it, expect } from "vitest";
import {
  generateBackupFilename,
  isValidBackupFilename,
  computeBackupHash,
  serializeBackup,
  deserializeBackup,
  shouldDebounceBackup,
  getBackupsToDelete,
  hasDataChanged,
} from "@/models/backup";
import type { ParsedSecret } from "@/models/types";
import type { BackupMetadata } from "@/models/backup";

const SAMPLE_SECRETS: ParsedSecret[] = [
  {
    name: "GitHub",
    account: "user@example.com",
    secret: "JBSWY3DPEHPK3PXP",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
  {
    name: "Google",
    account: "admin@gmail.com",
    secret: "MFRGGZDFMZTWQ2LK",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
];

// ── generateBackupFilename ──────────────────────────────────────────────────

describe("generateBackupFilename", () => {
  it("generates a valid filename", () => {
    const filename = generateBackupFilename();
    expect(isValidBackupFilename(filename)).toBe(true);
  });

  it("uses UTC date components", () => {
    const date = new Date("2026-03-15T14:30:45Z");
    const filename = generateBackupFilename(date);
    expect(filename).toBe("backup_2026-03-15_14-30-45.json");
  });

  it("pads single-digit values", () => {
    const date = new Date("2026-01-02T03:04:05Z");
    const filename = generateBackupFilename(date);
    expect(filename).toBe("backup_2026-01-02_03-04-05.json");
  });
});

// ── isValidBackupFilename ───────────────────────────────────────────────────

describe("isValidBackupFilename", () => {
  it("accepts valid filenames", () => {
    expect(isValidBackupFilename("backup_2026-03-15_14-30-45.json")).toBe(true);
    expect(isValidBackupFilename("backup_2026-01-01_00-00-00.json")).toBe(true);
  });

  it("rejects invalid filenames", () => {
    expect(isValidBackupFilename("backup.json")).toBe(false);
    expect(isValidBackupFilename("backup_2026-03-15.json")).toBe(false);
    expect(isValidBackupFilename("other_2026-03-15_14-30-45.json")).toBe(false);
    expect(isValidBackupFilename("")).toBe(false);
  });
});

// ── computeBackupHash ───────────────────────────────────────────────────────

describe("computeBackupHash", () => {
  it("produces consistent hash for same data", () => {
    const hash1 = computeBackupHash(SAMPLE_SECRETS);
    const hash2 = computeBackupHash(SAMPLE_SECRETS);
    expect(hash1).toBe(hash2);
  });

  it("produces different hash for different data", () => {
    const hash1 = computeBackupHash(SAMPLE_SECRETS);
    const hash2 = computeBackupHash([SAMPLE_SECRETS[0]]);
    expect(hash1).not.toBe(hash2);
  });

  it("is order-independent (sorted internally)", () => {
    const reversed = [...SAMPLE_SECRETS].reverse();
    const hash1 = computeBackupHash(SAMPLE_SECRETS);
    const hash2 = computeBackupHash(reversed);
    expect(hash1).toBe(hash2);
  });

  it("returns 8-char hex string", () => {
    const hash = computeBackupHash(SAMPLE_SECRETS);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("handles empty array", () => {
    const hash = computeBackupHash([]);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

// ── serializeBackup / deserializeBackup ─────────────────────────────────────

describe("serializeBackup / deserializeBackup", () => {
  it("round-trips secrets", () => {
    const json = serializeBackup(SAMPLE_SECRETS);
    const restored = deserializeBackup(json);
    expect(restored).not.toBeNull();
    expect(restored).toHaveLength(2);
    expect(restored![0].name).toBe("GitHub");
    expect(restored![0].secret).toBe("JBSWY3DPEHPK3PXP");
  });

  it("includes version and metadata", () => {
    const json = serializeBackup(SAMPLE_SECRETS);
    const data = JSON.parse(json);
    expect(data.version).toBe(1);
    expect(data.secretCount).toBe(2);
    expect(data.createdAt).toBeDefined();
  });

  it("handles empty array", () => {
    const json = serializeBackup([]);
    const restored = deserializeBackup(json);
    expect(restored).toEqual([]);
  });

  it("deserializes plain array (legacy format)", () => {
    const json = JSON.stringify(SAMPLE_SECRETS);
    const restored = deserializeBackup(json);
    expect(restored).toHaveLength(2);
  });

  it("deserializes {secrets: [...]} without version", () => {
    const json = JSON.stringify({ secrets: SAMPLE_SECRETS });
    const restored = deserializeBackup(json);
    expect(restored).toHaveLength(2);
  });

  it("returns null for invalid JSON", () => {
    expect(deserializeBackup("not json")).toBeNull();
  });

  it("returns null for unexpected structure", () => {
    expect(deserializeBackup(JSON.stringify({ data: "wrong" }))).toBeNull();
  });
});

// ── shouldDebounceBackup ────────────────────────────────────────────────────

describe("shouldDebounceBackup", () => {
  it("returns false when no previous backup", () => {
    expect(shouldDebounceBackup(null)).toBe(false);
  });

  it("returns true within debounce window (5 min)", () => {
    const now = new Date();
    const lastBackup = new Date(now.getTime() - 2 * 60 * 1000); // 2 min ago
    expect(shouldDebounceBackup(lastBackup, now)).toBe(true);
  });

  it("returns false after debounce window", () => {
    const now = new Date();
    const lastBackup = new Date(now.getTime() - 6 * 60 * 1000); // 6 min ago
    expect(shouldDebounceBackup(lastBackup, now)).toBe(false);
  });

  it("returns true at exactly the boundary", () => {
    const now = new Date();
    const lastBackup = new Date(now.getTime() - 5 * 60 * 1000 + 1); // just under 5 min
    expect(shouldDebounceBackup(lastBackup, now)).toBe(true);
  });
});

// ── getBackupsToDelete ──────────────────────────────────────────────────────

describe("getBackupsToDelete", () => {
  const makeBackups = (count: number): BackupMetadata[] =>
    Array.from({ length: count }, (_, i) => ({
      id: `backup-${i}`,
      filename: `backup_${i}.json`,
      secretCount: 1,
      encrypted: false,
      reason: "manual",
      hash: `hash-${i}`,
      createdAt: new Date(2026, 0, 1 + i),
    }));

  it("returns empty when under limit", () => {
    expect(getBackupsToDelete(makeBackups(50))).toEqual([]);
  });

  it("returns empty when at limit", () => {
    expect(getBackupsToDelete(makeBackups(100))).toEqual([]);
  });

  it("returns oldest IDs when over limit", () => {
    const backups = makeBackups(103);
    const toDelete = getBackupsToDelete(backups);
    expect(toDelete).toHaveLength(3);
    expect(toDelete).toEqual(["backup-0", "backup-1", "backup-2"]);
  });

  it("respects custom maxCount", () => {
    const backups = makeBackups(5);
    const toDelete = getBackupsToDelete(backups, 3);
    expect(toDelete).toHaveLength(2);
    expect(toDelete).toEqual(["backup-0", "backup-1"]);
  });
});

// ── hasDataChanged ──────────────────────────────────────────────────────────

describe("hasDataChanged", () => {
  it("returns true when no previous hash", () => {
    expect(hasDataChanged("abc123", null)).toBe(true);
  });

  it("returns false when hashes match", () => {
    expect(hasDataChanged("abc123", "abc123")).toBe(false);
  });

  it("returns true when hashes differ", () => {
    expect(hasDataChanged("abc123", "def456")).toBe(true);
  });
});
