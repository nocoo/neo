/**
 * Settings server actions tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetUserSettings,
  mockUpsertUserSettings,
  mockGetEncryptionKey,
  mockSetEncryptionKey,
  mockScopedDB,
} = vi.hoisted(() => {
  const mockGetUserSettings = vi.fn();
  const mockUpsertUserSettings = vi.fn();
  const mockGetEncryptionKey = vi.fn();
  const mockSetEncryptionKey = vi.fn();

  return {
    mockGetUserSettings,
    mockUpsertUserSettings,
    mockGetEncryptionKey,
    mockSetEncryptionKey,
    mockScopedDB: {
      getUserSettings: mockGetUserSettings,
      upsertUserSettings: mockUpsertUserSettings,
      getEncryptionKey: mockGetEncryptionKey,
      setEncryptionKey: mockSetEncryptionKey,
    },
  };
});

vi.mock("@/lib/auth-context", () => ({
  getScopedDB: vi.fn().mockResolvedValue(mockScopedDB),
  getSession: vi.fn(),
  getAuthContext: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/models/encryption", () => ({
  generateEncryptionKey: vi.fn().mockResolvedValue("generatedBase64Key=="),
}));

import {
  getUserSettings,
  updateUserSettings,
  getEncryptionKey,
  generateAndSaveEncryptionKey,
} from "@/actions/settings";
import { getScopedDB } from "@/lib/auth-context";

const sampleSettings = {
  userId: "test-user-id",
  encryptionKeyHash: null,
  theme: "system",
  language: "en",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getScopedDB).mockResolvedValue(mockScopedDB as never);
});

describe("getUserSettings", () => {
  it("returns settings for authenticated user", async () => {
    mockGetUserSettings.mockResolvedValue(sampleSettings);
    const result = await getUserSettings();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.theme).toBe("system");
  });

  it("returns null when no settings exist", async () => {
    mockGetUserSettings.mockResolvedValue(null);
    const result = await getUserSettings();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getUserSettings();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("handles errors gracefully", async () => {
    mockGetUserSettings.mockRejectedValue(new Error("DB error"));
    const result = await getUserSettings();
    expect(result.success).toBe(false);
  });
});

describe("updateUserSettings", () => {
  it("updates theme", async () => {
    mockUpsertUserSettings.mockResolvedValue({ ...sampleSettings, theme: "dark" });
    const result = await updateUserSettings({ theme: "dark" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.theme).toBe("dark");
  });

  it("updates language", async () => {
    mockUpsertUserSettings.mockResolvedValue({ ...sampleSettings, language: "zh" });
    const result = await updateUserSettings({ language: "zh" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.language).toBe("zh");
  });

  it("rejects invalid theme", async () => {
    const result = await updateUserSettings({ theme: "neon" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Invalid theme");
  });

  it("rejects invalid language", async () => {
    const result = await updateUserSettings({ language: "fr" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("Invalid language");
  });

  it("updates encryption key hash", async () => {
    mockUpsertUserSettings.mockResolvedValue({ ...sampleSettings, encryptionKeyHash: "hash123" });
    const result = await updateUserSettings({ encryptionKeyHash: "hash123" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.encryptionKeyHash).toBe("hash123");
  });

  it("clears encryption key hash", async () => {
    mockUpsertUserSettings.mockResolvedValue({ ...sampleSettings, encryptionKeyHash: null });
    const result = await updateUserSettings({ encryptionKeyHash: null });
    expect(result.success).toBe(true);
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await updateUserSettings({ theme: "dark" });
    expect(result.success).toBe(false);
  });

  it("handles errors gracefully", async () => {
    mockUpsertUserSettings.mockRejectedValue(new Error("DB error"));
    const result = await updateUserSettings({ theme: "dark" });
    expect(result.success).toBe(false);
  });
});

describe("getEncryptionKey", () => {
  it("returns encryption key when present", async () => {
    mockGetEncryptionKey.mockResolvedValue("base64key==");
    const result = await getEncryptionKey();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("base64key==");
  });

  it("returns null when no key", async () => {
    mockGetEncryptionKey.mockResolvedValue(null);
    const result = await getEncryptionKey();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await getEncryptionKey();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("handles errors gracefully", async () => {
    mockGetEncryptionKey.mockRejectedValue(new Error("fail"));
    const result = await getEncryptionKey();
    expect(result.success).toBe(false);
  });
});

describe("generateAndSaveEncryptionKey", () => {
  it("generates and saves a new key", async () => {
    mockSetEncryptionKey.mockResolvedValue(undefined);
    const result = await generateAndSaveEncryptionKey();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("generatedBase64Key==");
    expect(mockSetEncryptionKey).toHaveBeenCalledWith("generatedBase64Key==");
  });

  it("returns unauthorized when not authenticated", async () => {
    vi.mocked(getScopedDB).mockResolvedValue(null);
    const result = await generateAndSaveEncryptionKey();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toBe("Unauthorized");
  });

  it("handles errors gracefully", async () => {
    mockSetEncryptionKey.mockRejectedValue(new Error("DB error"));
    const result = await generateAndSaveEncryptionKey();
    expect(result.success).toBe(false);
  });
});
