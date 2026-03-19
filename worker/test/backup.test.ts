/**
 * Cron backup tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeSecretsHash,
  generateBackupFilename,
  backupUserSecrets,
  cleanupOldBackups,
  runCronBackup,
} from "../src/backup";
import type { Env } from "../src/types";

// ── D1 mock helpers ────────────────────────────────────────

interface MockStatement {
  bind: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function createMockStatement(overrides: Partial<MockStatement> = {}): MockStatement {
  const stmt: MockStatement = {
    bind: vi.fn(),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  };
  // bind() returns the same statement (chainable)
  stmt.bind.mockReturnValue(stmt);
  return stmt;
}

function createMockEnv(prepareOverride?: (sql: string) => MockStatement): Env {
  return {
    DB: {
      prepare: prepareOverride
        ? vi.fn(prepareOverride)
        : vi.fn(() => createMockStatement()),
    } as unknown as D1Database,
    ENVIRONMENT: "test",
  };
}

// ── Sample data ────────────────────────────────────────────

const sampleSecrets = [
  {
    id: "s1",
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
    id: "s2",
    name: "GitLab",
    account: null,
    secret: "HXDMVJECJJWSRB3H",
    type: "totp",
    digits: 6,
    period: 30,
    algorithm: "SHA-1",
    counter: 0,
  },
];

// ── Tests ──────────────────────────────────────────────────

describe("computeSecretsHash", () => {
  it("returns consistent hash for same data", async () => {
    const hash1 = await computeSecretsHash(sampleSecrets);
    const hash2 = await computeSecretsHash(sampleSecrets);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different hash for different data", async () => {
    const hash1 = await computeSecretsHash(sampleSecrets);
    const modified = [{ ...sampleSecrets[0], name: "Modified" }];
    const hash2 = await computeSecretsHash(modified);
    expect(hash1).not.toBe(hash2);
  });

  it("is order-independent (sorts by id)", async () => {
    const reversed = [...sampleSecrets].reverse();
    const hash1 = await computeSecretsHash(sampleSecrets);
    const hash2 = await computeSecretsHash(reversed);
    expect(hash1).toBe(hash2);
  });

  it("returns different hash for empty vs non-empty", async () => {
    const hash1 = await computeSecretsHash([]);
    const hash2 = await computeSecretsHash(sampleSecrets);
    expect(hash1).not.toBe(hash2);
  });
});

describe("generateBackupFilename", () => {
  it("returns correctly formatted filename", () => {
    const filename = generateBackupFilename();
    expect(filename).toMatch(/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.json$/);
  });
});

describe("backupUserSecrets", () => {
  it("skips backup when user has no secrets", async () => {
    const env = createMockEnv();
    const result = await backupUserSecrets("user1", env);
    expect(result.created).toBe(false);
    expect(result.reason).toBe("no_secrets");
  });

  it("skips backup when hash is unchanged", async () => {
    const hash = await computeSecretsHash(sampleSecrets);

    const env = createMockEnv((sql: string) => {
      if (sql.includes("FROM secrets")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: sampleSecrets }),
        });
      }
      if (sql.includes("FROM backups")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue({ hash }),
        });
      }
      return createMockStatement();
    });

    const result = await backupUserSecrets("user1", env);
    expect(result.created).toBe(false);
    expect(result.reason).toBe("unchanged");
  });

  it("creates backup when hash differs", async () => {
    const insertStmt = createMockStatement();
    const cleanupCountStmt = createMockStatement({
      first: vi.fn().mockResolvedValue({ count: 1 }),
    });

    const env = createMockEnv((sql: string) => {
      if (sql.includes("FROM secrets")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: sampleSecrets }),
        });
      }
      if (sql.includes("FROM backups") && sql.includes("hash")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue({ hash: "old-hash" }),
        });
      }
      if (sql.includes("INSERT INTO backups")) {
        return insertStmt;
      }
      if (sql.includes("COUNT(*)")) {
        return cleanupCountStmt;
      }
      return createMockStatement();
    });

    const result = await backupUserSecrets("user1", env);
    expect(result.created).toBe(true);
    expect(insertStmt.run).toHaveBeenCalled();
  });

  it("creates backup when no previous backup exists", async () => {
    const insertStmt = createMockStatement();
    const cleanupCountStmt = createMockStatement({
      first: vi.fn().mockResolvedValue({ count: 1 }),
    });

    const env = createMockEnv((sql: string) => {
      if (sql.includes("FROM secrets")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: sampleSecrets }),
        });
      }
      if (sql.includes("FROM backups") && sql.includes("hash")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue(null),
        });
      }
      if (sql.includes("INSERT INTO backups")) {
        return insertStmt;
      }
      if (sql.includes("COUNT(*)")) {
        return cleanupCountStmt;
      }
      return createMockStatement();
    });

    const result = await backupUserSecrets("user1", env);
    expect(result.created).toBe(true);
  });

  it("encrypts backup when ENCRYPTION_KEY is set", async () => {
    // Generate a valid 32-byte key in base64
    const keyBytes = new Uint8Array(32);
    crypto.getRandomValues(keyBytes);
    const encryptionKey = btoa(String.fromCharCode(...keyBytes));

    let insertedData = "";
    const insertStmt = createMockStatement();
    insertStmt.bind = vi.fn((...args: unknown[]) => {
      insertedData = args[3] as string; // 4th arg is data
      return insertStmt;
    });

    const cleanupCountStmt = createMockStatement({
      first: vi.fn().mockResolvedValue({ count: 1 }),
    });

    const env = createMockEnv((sql: string) => {
      if (sql.includes("FROM secrets")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: sampleSecrets }),
        });
      }
      if (sql.includes("FROM backups") && sql.includes("hash")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue(null),
        });
      }
      if (sql.includes("INSERT INTO backups")) {
        return insertStmt;
      }
      if (sql.includes("COUNT(*)")) {
        return cleanupCountStmt;
      }
      return createMockStatement();
    });
    env.ENCRYPTION_KEY = encryptionKey;

    const result = await backupUserSecrets("user1", env);
    expect(result.created).toBe(true);
    expect(insertedData).toMatch(/^v1:/);
  });

  it("stores plaintext when no ENCRYPTION_KEY", async () => {
    let insertedData = "";
    const insertStmt = createMockStatement();
    insertStmt.bind = vi.fn((...args: unknown[]) => {
      insertedData = args[3] as string;
      return insertStmt;
    });

    const cleanupCountStmt = createMockStatement({
      first: vi.fn().mockResolvedValue({ count: 1 }),
    });

    const env = createMockEnv((sql: string) => {
      if (sql.includes("FROM secrets")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: sampleSecrets }),
        });
      }
      if (sql.includes("FROM backups") && sql.includes("hash")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue(null),
        });
      }
      if (sql.includes("INSERT INTO backups")) {
        return insertStmt;
      }
      if (sql.includes("COUNT(*)")) {
        return cleanupCountStmt;
      }
      return createMockStatement();
    });

    await backupUserSecrets("user1", env);
    const parsed = JSON.parse(insertedData);
    expect(parsed.version).toBe("1.0");
    expect(parsed.count).toBe(2);
    expect(parsed.secrets).toHaveLength(2);
  });
});

describe("cleanupOldBackups", () => {
  it("does nothing when under limit", async () => {
    const env = createMockEnv((sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue({ count: 50 }),
        });
      }
      return createMockStatement();
    });

    const deleted = await cleanupOldBackups("user1", env);
    expect(deleted).toBe(0);
  });

  it("deletes excess backups", async () => {
    const deleteStmt = createMockStatement();
    const excessIds = Array.from({ length: 5 }, (_, i) => ({ id: `bk_${i}` }));

    const env = createMockEnv((sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue({ count: 105 }),
        });
      }
      if (sql.includes("ORDER BY created_at ASC")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: excessIds }),
        });
      }
      if (sql.includes("DELETE FROM backups")) {
        return deleteStmt;
      }
      return createMockStatement();
    });

    const deleted = await cleanupOldBackups("user1", env);
    expect(deleted).toBe(5);
    expect(deleteStmt.run).toHaveBeenCalled();
  });

  it("does nothing when exactly at limit", async () => {
    const env = createMockEnv((sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue({ count: 100 }),
        });
      }
      return createMockStatement();
    });

    const deleted = await cleanupOldBackups("user1", env);
    expect(deleted).toBe(0);
  });
});

describe("runCronBackup", () => {
  it("does nothing when no users have secrets", async () => {
    const env = createMockEnv();
    await runCronBackup(env); // should not throw
  });

  it("processes each user with secrets", async () => {
    const insertStmt = createMockStatement();
    const cleanupCountStmt = createMockStatement({
      first: vi.fn().mockResolvedValue({ count: 1 }),
    });

    const env = createMockEnv((sql: string) => {
      if (sql.includes("DISTINCT user_id")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({
            results: [{ user_id: "u1" }, { user_id: "u2" }],
          }),
        });
      }
      if (sql.includes("FROM secrets WHERE")) {
        return createMockStatement({
          all: vi.fn().mockResolvedValue({ results: sampleSecrets }),
        });
      }
      if (sql.includes("FROM backups") && sql.includes("hash")) {
        return createMockStatement({
          first: vi.fn().mockResolvedValue(null),
        });
      }
      if (sql.includes("INSERT INTO backups")) {
        return insertStmt;
      }
      if (sql.includes("COUNT(*)")) {
        return cleanupCountStmt;
      }
      return createMockStatement();
    });

    await runCronBackup(env);
    // INSERT should have been called at least twice (once per user)
    expect(insertStmt.run.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
