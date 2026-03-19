/**
 * Secret CRUD server actions tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock auth ───────────────────────────────────────────────────────────

const {
  mockGetSecrets,
  mockGetSecretById,
  mockCreateSecret,
  mockUpdateSecret,
  mockDeleteSecret,
  mockGetSecretCount,
  mockScopedDB,
} = vi.hoisted(() => {
  const mockGetSecrets = vi.fn();
  const mockGetSecretById = vi.fn();
  const mockCreateSecret = vi.fn();
  const mockUpdateSecret = vi.fn();
  const mockDeleteSecret = vi.fn();
  const mockGetSecretCount = vi.fn();

  return {
    mockGetSecrets,
    mockGetSecretById,
    mockCreateSecret,
    mockUpdateSecret,
    mockDeleteSecret,
    mockGetSecretCount,
    mockScopedDB: {
      getSecrets: mockGetSecrets,
      getSecretById: mockGetSecretById,
      createSecret: mockCreateSecret,
      updateSecret: mockUpdateSecret,
      deleteSecret: mockDeleteSecret,
      getSecretCount: mockGetSecretCount,
    },
  };
});

vi.mock("@/lib/auth-context", () => ({
  getScopedDB: vi.fn().mockResolvedValue(mockScopedDB),
  getSession: vi.fn(),
  getAuthContext: vi.fn(),
  requireAuth: vi.fn(),
}));

import {
  getSecrets,
  getSecretById,
  createSecret,
  updateSecret,
  deleteSecret,
  getSecretCount,
  batchImportSecrets,
} from "@/actions/secrets";
import { getScopedDB } from "@/lib/auth-context";

// ── Sample data ─────────────────────────────────────────────────────────

const sampleSecret = {
  id: "s_test_123",
  userId: "test-user-id",
  name: "GitHub",
  account: "user@example.com",
  secret: "JBSWY3DPEHPK3PXP",
  type: "totp" as const,
  digits: 6,
  period: 30,
  algorithm: "SHA-1" as const,
  counter: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ── Setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScopedDB).mockResolvedValue(mockScopedDB as never);
});

// ── Tests ───────────────────────────────────────────────────────────────

describe("getSecrets", () => {
  it("returns secrets for authenticated user", async () => {
    mockGetSecrets.mockResolvedValue([sampleSecret]);
    const result = await getSecrets();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("GitHub");
    }
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getSecrets();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("handles database errors gracefully", async () => {
    mockGetSecrets.mockRejectedValue(new Error("DB error"));
    const result = await getSecrets();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Failed to load secrets");
  });
});

describe("getSecretById", () => {
  it("returns secret when found", async () => {
    mockGetSecretById.mockResolvedValue(sampleSecret);
    const result = await getSecretById("s_test_123");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("GitHub");
  });

  it("returns error when not found", async () => {
    mockGetSecretById.mockResolvedValue(null);
    const result = await getSecretById("nonexistent");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Secret not found");
  });

  it("returns error for empty ID", async () => {
    const result = await getSecretById("");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Secret ID is required");
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getSecretById("s_test_123");
    expect(result.success).toBe(false);
  });
});

describe("createSecret", () => {
  it("creates secret with valid input", async () => {
    mockCreateSecret.mockResolvedValue(sampleSecret);
    const result = await createSecret({
      name: "GitHub",
      secret: "JBSWY3DPEHPK3PXP",
    });
    expect(result.success).toBe(true);
    expect(mockCreateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "GitHub",
        secret: "JBSWY3DPEHPK3PXP",
        type: "totp",
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
      })
    );
  });

  it("rejects empty name", async () => {
    const result = await createSecret({ name: "", secret: "JBSWY3DPEHPK3PXP" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Name is required");
  });

  it("rejects invalid base32 secret", async () => {
    const result = await createSecret({ name: "Test", secret: "INVALID!@#" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Invalid secret");
  });

  it("trims whitespace from name and account", async () => {
    mockCreateSecret.mockResolvedValue(sampleSecret);
    await createSecret({
      name: "  GitHub  ",
      account: "  user@example.com  ",
      secret: "JBSWY3DPEHPK3PXP",
    });
    expect(mockCreateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "GitHub",
        account: "user@example.com",
      })
    );
  });

  it("normalizes secret to uppercase without spaces", async () => {
    mockCreateSecret.mockResolvedValue(sampleSecret);
    await createSecret({
      name: "Test",
      secret: "jbsw y3dp ehpk 3pxp",
    });
    expect(mockCreateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        secret: "JBSWY3DPEHPK3PXP",
      })
    );
  });

  it("applies default OTP parameters", async () => {
    mockCreateSecret.mockResolvedValue(sampleSecret);
    await createSecret({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
    expect(mockCreateSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "totp",
        digits: 6,
        period: 30,
        algorithm: "SHA-1",
        counter: 0,
      })
    );
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await createSecret({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
    expect(result.success).toBe(false);
  });

  it("handles database errors gracefully", async () => {
    mockCreateSecret.mockRejectedValue(new Error("DB error"));
    const result = await createSecret({ name: "Test", secret: "JBSWY3DPEHPK3PXP" });
    expect(result.success).toBe(false);
  });
});

describe("updateSecret", () => {
  it("updates secret with valid input", async () => {
    mockUpdateSecret.mockResolvedValue({ ...sampleSecret, name: "Updated" });
    const result = await updateSecret({ id: "s_test_123", name: "Updated" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Updated");
  });

  it("rejects empty ID", async () => {
    const result = await updateSecret({ id: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Secret ID is required");
  });

  it("rejects invalid secret value", async () => {
    const result = await updateSecret({ id: "s_test_123", secret: "BAD!@#" });
    expect(result.success).toBe(false);
  });

  it("returns error when secret not found", async () => {
    mockUpdateSecret.mockResolvedValue(null);
    const result = await updateSecret({ id: "nonexistent", name: "Updated" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Secret not found");
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await updateSecret({ id: "s_test_123", name: "Updated" });
    expect(result.success).toBe(false);
  });
});

describe("deleteSecret", () => {
  it("deletes secret successfully", async () => {
    mockDeleteSecret.mockResolvedValue(true);
    const result = await deleteSecret("s_test_123");
    expect(result.success).toBe(true);
    expect(mockDeleteSecret).toHaveBeenCalledWith("s_test_123");
  });

  it("rejects empty ID", async () => {
    const result = await deleteSecret("");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Secret ID is required");
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await deleteSecret("s_test_123");
    expect(result.success).toBe(false);
  });
});

describe("getSecretCount", () => {
  it("returns count", async () => {
    mockGetSecretCount.mockResolvedValue(42);
    const result = await getSecretCount();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe(42);
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getSecretCount();
    expect(result.success).toBe(false);
  });
});

describe("batchImportSecrets", () => {
  it("imports valid secrets", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockCreateSecret.mockResolvedValue(sampleSecret);
    const result = await batchImportSecrets([
      { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      { name: "GitLab", secret: "HXDMVJECJJWSRB3H" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imported).toBe(2);
      expect(result.data.skipped).toBe(0);
    }
  });

  it("skips invalid secrets", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockCreateSecret.mockResolvedValue(sampleSecret);
    const result = await batchImportSecrets([
      { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      { name: "", secret: "INVALID" },
      { name: "Test", secret: "BAD!@#" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imported).toBe(1);
      expect(result.data.skipped).toBe(2);
    }
  });

  it("rejects empty array", async () => {
    const result = await batchImportSecrets([]);
    expect(result.success).toBe(false);
  });

  it("rejects more than 100 secrets", async () => {
    const secrets = Array.from({ length: 101 }, (_, i) => ({
      name: `Secret ${i}`,
      secret: "JBSWY3DPEHPK3PXP",
    }));
    const result = await batchImportSecrets(secrets);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Maximum 100");
  });

  it("handles individual create failures", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockCreateSecret
      .mockResolvedValueOnce(sampleSecret)
      .mockRejectedValueOnce(new Error("Conflict"));
    const result = await batchImportSecrets([
      { name: "Good", secret: "JBSWY3DPEHPK3PXP" },
      { name: "Bad", secret: "HXDMVJECJJWSRB3H" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imported).toBe(1);
      expect(result.data.skipped).toBe(1);
    }
  });

  it("skips duplicates against existing secrets", async () => {
    mockGetSecrets.mockResolvedValue([
      { ...sampleSecret, name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
    ]);
    mockCreateSecret.mockResolvedValue(sampleSecret);
    const result = await batchImportSecrets([
      { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      { name: "AWS", secret: "GEZDGNBVGY3TQOJQ" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imported).toBe(1);
      expect(result.data.duplicates).toBe(1);
    }
  });

  it("skips within-batch duplicates", async () => {
    mockGetSecrets.mockResolvedValue([]);
    mockCreateSecret.mockResolvedValue(sampleSecret);
    const result = await batchImportSecrets([
      { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
      { name: "GitHub", secret: "JBSWY3DPEHPK3PXP" },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.imported).toBe(1);
      expect(result.data.duplicates).toBe(1);
    }
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await batchImportSecrets([
      { name: "Test", secret: "JBSWY3DPEHPK3PXP" },
    ]);
    expect(result.success).toBe(false);
  });
});
