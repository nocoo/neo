/**
 * Backy server action tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const {
  mockGetSecrets,
  mockGetBackySettings,
  mockUpsertBackySettings,
  mockGetEncryptionKey,
  mockGetBackyPullWebhook,
  mockUpsertBackyPullWebhook,
  mockDeleteBackyPullWebhook,
  mockScopedDB,
} = vi.hoisted(() => {
  const mockGetSecrets = vi.fn();
  const mockGetBackySettings = vi.fn();
  const mockUpsertBackySettings = vi.fn();
  const mockGetEncryptionKey = vi.fn();
  const mockGetBackyPullWebhook = vi.fn();
  const mockUpsertBackyPullWebhook = vi.fn();
  const mockDeleteBackyPullWebhook = vi.fn();

  return {
    mockGetSecrets,
    mockGetBackySettings,
    mockUpsertBackySettings,
    mockGetEncryptionKey,
    mockGetBackyPullWebhook,
    mockUpsertBackyPullWebhook,
    mockDeleteBackyPullWebhook,
    mockScopedDB: {
      getSecrets: mockGetSecrets,
      getBackySettings: mockGetBackySettings,
      upsertBackySettings: mockUpsertBackySettings,
      getEncryptionKey: mockGetEncryptionKey,
      getBackyPullWebhook: mockGetBackyPullWebhook,
      upsertBackyPullWebhook: mockUpsertBackyPullWebhook,
      deleteBackyPullWebhook: mockDeleteBackyPullWebhook,
    },
  };
});

vi.mock("@/lib/auth-context", () => ({
  getScopedDB: vi.fn().mockResolvedValue(mockScopedDB),
  getSession: vi.fn(),
  getAuthContext: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/models/backup-archive", () => ({
  createEncryptedZip: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  generateArchiveFilename: vi.fn().mockReturnValue("neo-backup-2026-03-20.zip"),
}));

import {
  pushBackupToBacky,
  getBackyConfig,
  saveBackyConfig,
  testBackyConnection,
  fetchBackyHistory,
  getBackyPullWebhook,
  generateBackyPullWebhook,
  revokeBackyPullWebhook,
} from "@/actions/backy";
import { getScopedDB } from "@/lib/auth-context";

// ── Setup ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScopedDB).mockResolvedValue(mockScopedDB as never);
  // Reset global fetch mock
  vi.stubGlobal("fetch", vi.fn());
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("pushBackupToBacky", () => {
  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await pushBackupToBacky();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("returns error when backy not configured", async () => {
    mockGetBackySettings.mockResolvedValue(null);
    const result = await pushBackupToBacky();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Backy not configured");
  });

  it("returns error when no encryption key", async () => {
    mockGetBackySettings.mockResolvedValue({ webhookUrl: "https://backy.test/webhook/p1", apiKey: "key123" });
    mockGetEncryptionKey.mockResolvedValue(null);
    const result = await pushBackupToBacky();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("No encryption key");
  });

  it("pushes backup successfully", async () => {
    mockGetBackySettings.mockResolvedValue({ webhookUrl: "https://backy.test/webhook/p1", apiKey: "key123" });
    mockGetEncryptionKey.mockResolvedValue("dGVzdGtleQ==");
    mockGetSecrets.mockResolvedValue([
      { id: "s1", name: "GitHub", account: null, secret: "JBSWY3DPEHPK3PXP", type: "totp", digits: 6, period: 30, algorithm: "SHA-1", counter: 0 },
    ]);

    const mockFetch = vi.fn()
      // POST response
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      })
      // GET history response
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ backups: [], totalCount: 0 }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const result = await pushBackupToBacky();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ok).toBe(true);
      expect(result.data.durationMs).toBeGreaterThanOrEqual(0);
    }

    // Verify FormData was sent correctly
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [pushUrl, pushInit] = mockFetch.mock.calls[0];
    expect(pushUrl).toBe("https://backy.test/webhook/p1");
    expect(pushInit.method).toBe("POST");
    expect(pushInit.headers.Authorization).toBe("Bearer key123");
    expect(pushInit.body).toBeInstanceOf(FormData);
  });

  it("returns error on push failure", async () => {
    mockGetBackySettings.mockResolvedValue({ webhookUrl: "https://backy.test/webhook/p1", apiKey: "key123" });
    mockGetEncryptionKey.mockResolvedValue("dGVzdGtleQ==");
    mockGetSecrets.mockResolvedValue([]);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 413,
      text: () => Promise.resolve("Payload too large"),
    }));

    const result = await pushBackupToBacky();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("413");
  });
});

describe("getBackyConfig", () => {
  it("returns null when not configured", async () => {
    mockGetBackySettings.mockResolvedValue(null);
    const result = await getBackyConfig();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns config with masked key", async () => {
    mockGetBackySettings.mockResolvedValue({
      webhookUrl: "https://backy.test/webhook/p1",
      apiKey: "abcdefghijklmnopqrstuvwxyz123456789012345678",
    });
    const result = await getBackyConfig();
    expect(result.success).toBe(true);
    if (result.success && result.data) {
      expect(result.data.webhookUrl).toBe("https://backy.test/webhook/p1");
      expect(result.data.maskedApiKey).toContain("•");
    }
  });
});

describe("saveBackyConfig", () => {
  it("validates config before saving", async () => {
    const result = await saveBackyConfig({ webhookUrl: "", apiKey: "key" });
    expect(result.success).toBe(false);
  });

  it("saves valid config", async () => {
    mockUpsertBackySettings.mockResolvedValue(undefined);
    const result = await saveBackyConfig({
      webhookUrl: "https://backy.test/api/webhook/project1",
      apiKey: "abcdefghijklmnopqrstuvwxyz123456789012345678",
    });
    expect(result.success).toBe(true);
    expect(mockUpsertBackySettings).toHaveBeenCalled();
  });
});

describe("testBackyConnection", () => {
  it("returns error when not configured", async () => {
    mockGetBackySettings.mockResolvedValue(null);
    const result = await testBackyConnection();
    expect(result.success).toBe(false);
  });

  it("tests connection via HEAD request", async () => {
    mockGetBackySettings.mockResolvedValue({ webhookUrl: "https://backy.test/webhook/p1", apiKey: "key123" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

    const result = await testBackyConnection();
    expect(result.success).toBe(true);
  });

  it("returns error on failed connection", async () => {
    mockGetBackySettings.mockResolvedValue({ webhookUrl: "https://backy.test/webhook/p1", apiKey: "key123" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const result = await testBackyConnection();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("401");
  });
});

describe("fetchBackyHistory", () => {
  it("returns error when not configured", async () => {
    mockGetBackySettings.mockResolvedValue(null);
    const result = await fetchBackyHistory();
    expect(result.success).toBe(false);
  });

  it("fetches history successfully", async () => {
    mockGetBackySettings.mockResolvedValue({ webhookUrl: "https://backy.test/webhook/p1", apiKey: "key123" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ backups: [{ id: "b1" }], totalCount: 1 }),
    }));

    const result = await fetchBackyHistory();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalCount).toBe(1);
  });
});

describe("pull webhook key CRUD", () => {
  it("gets null when no key configured", async () => {
    mockGetBackyPullWebhook.mockResolvedValue(null);
    const result = await getBackyPullWebhook();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("generates a pull webhook key", async () => {
    mockUpsertBackyPullWebhook.mockResolvedValue(undefined);
    const result = await generateBackyPullWebhook();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeTruthy();
      expect(result.data.length).toBe(48);
    }
  });

  it("revokes pull webhook key", async () => {
    mockDeleteBackyPullWebhook.mockResolvedValue(undefined);
    const result = await revokeBackyPullWebhook();
    expect(result.success).toBe(true);
    expect(mockDeleteBackyPullWebhook).toHaveBeenCalled();
  });

  it("returns error when generateBackyPullWebhook throws", async () => {
    mockUpsertBackyPullWebhook.mockRejectedValue(new Error("DB error"));
    const result = await generateBackyPullWebhook();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Failed to generate pull webhook");
  });

  it("returns error when revokeBackyPullWebhook throws", async () => {
    mockDeleteBackyPullWebhook.mockRejectedValue(new Error("DB error"));
    const result = await revokeBackyPullWebhook();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Failed to revoke pull webhook");
  });
});
