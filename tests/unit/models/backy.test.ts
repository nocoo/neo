/**
 * Backy integration model tests.
 * Covers all pure functions: validation, masking, tag building,
 * formatting, environment detection.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isValidWebhookUrl,
  validateBackyConfig,
  maskApiKey,
  getBackyEnvironment,
  buildBackyTag,
  formatFileSize,
  formatTimeAgo,
} from "@/models/backy";

// ── isValidWebhookUrl ────────────────────────────────────────────────────────

describe("isValidWebhookUrl", () => {
  it("accepts https URL", () => {
    expect(isValidWebhookUrl("https://backy.example.com/api/webhook/123")).toBe(
      true,
    );
  });

  it("accepts http URL", () => {
    expect(isValidWebhookUrl("http://localhost:3000/api/webhook/123")).toBe(
      true,
    );
  });

  it("rejects empty string", () => {
    expect(isValidWebhookUrl("")).toBe(false);
  });

  it("rejects invalid URL", () => {
    expect(isValidWebhookUrl("not-a-url")).toBe(false);
  });

  it("rejects ftp protocol", () => {
    expect(isValidWebhookUrl("ftp://example.com/backup")).toBe(false);
  });

  it("rejects javascript protocol", () => {
    expect(isValidWebhookUrl("javascript:alert(1)")).toBe(false);
  });
});

// ── validateBackyConfig ──────────────────────────────────────────────────────

describe("validateBackyConfig", () => {
  it("accepts valid config", () => {
    const result = validateBackyConfig({
      webhookUrl: "https://backy.example.com/api/webhook/123",
      apiKey: "abc123def456",
    });
    expect(result).toEqual({ valid: true });
  });

  it("rejects missing webhookUrl", () => {
    const result = validateBackyConfig({ apiKey: "abc123" });
    expect(result).toEqual({ valid: false, error: expect.stringContaining("Webhook URL") });
  });

  it("rejects empty webhookUrl", () => {
    const result = validateBackyConfig({ webhookUrl: "  ", apiKey: "abc123" });
    expect(result).toEqual({ valid: false, error: expect.stringContaining("Webhook URL") });
  });

  it("rejects invalid webhookUrl", () => {
    const result = validateBackyConfig({
      webhookUrl: "not-a-url",
      apiKey: "abc123",
    });
    expect(result).toEqual({ valid: false, error: expect.stringContaining("valid URL") });
  });

  it("rejects missing apiKey", () => {
    const result = validateBackyConfig({
      webhookUrl: "https://example.com/webhook",
    });
    expect(result).toEqual({ valid: false, error: expect.stringContaining("API Key") });
  });

  it("rejects empty apiKey", () => {
    const result = validateBackyConfig({
      webhookUrl: "https://example.com/webhook",
      apiKey: "   ",
    });
    expect(result).toEqual({ valid: false, error: expect.stringContaining("API Key") });
  });

  it("rejects empty config", () => {
    const result = validateBackyConfig({});
    expect(result.valid).toBe(false);
  });
});

// ── maskApiKey ───────────────────────────────────────────────────────────────

describe("maskApiKey", () => {
  it("masks long key (show first 4 + last 4)", () => {
    expect(maskApiKey("abcdefghijklmnop")).toBe("abcd••••••••mnop");
  });

  it("masks 10-char key", () => {
    expect(maskApiKey("1234567890")).toBe("1234••7890");
  });

  it("fully masks short key (< 10 chars)", () => {
    expect(maskApiKey("short")).toBe("•••••");
  });

  it("fully masks 9-char key", () => {
    expect(maskApiKey("123456789")).toBe("•••••••••");
  });

  it("handles empty string", () => {
    expect(maskApiKey("")).toBe("");
  });

  it("handles single char", () => {
    expect(maskApiKey("x")).toBe("•");
  });
});

// ── getBackyEnvironment ──────────────────────────────────────────────────────

describe("getBackyEnvironment", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("returns 'prod' in production", () => {
    process.env.NODE_ENV = "production";
    expect(getBackyEnvironment()).toBe("prod");
  });

  it("returns 'dev' in development", () => {
    process.env.NODE_ENV = "development";
    expect(getBackyEnvironment()).toBe("dev");
  });

  it("returns 'dev' in test", () => {
    process.env.NODE_ENV = "test";
    expect(getBackyEnvironment()).toBe("dev");
  });
});

// ── buildBackyTag ────────────────────────────────────────────────────────────

describe("buildBackyTag", () => {
  it("builds tag with correct format", () => {
    expect(buildBackyTag("0.8.0", 12, "2026-03-20")).toBe(
      "v0.8.0-2026-03-20-12secrets",
    );
  });

  it("handles zero secrets", () => {
    expect(buildBackyTag("1.0.0", 0, "2026-01-01")).toBe(
      "v1.0.0-2026-01-01-0secrets",
    );
  });

  it("uses current date when not provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T10:00:00Z"));

    expect(buildBackyTag("0.8.0", 5)).toBe("v0.8.0-2026-06-15-5secrets");

    vi.useRealTimers();
  });

  it("handles large secret count", () => {
    expect(buildBackyTag("2.0.0", 999, "2026-12-31")).toBe(
      "v2.0.0-2026-12-31-999secrets",
    );
  });
});

// ── formatFileSize ───────────────────────────────────────────────────────────

describe("formatFileSize", () => {
  it("formats bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(10240)).toBe("10.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(5.5 * 1024 * 1024)).toBe("5.5 MB");
  });
});

// ── formatTimeAgo ────────────────────────────────────────────────────────────

describe("formatTimeAgo", () => {
  it("shows 'just now' for recent time", () => {
    const now = new Date().toISOString();
    expect(formatTimeAgo(now)).toBe("just now");
  });

  it("shows minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("shows hours ago", () => {
    const threeHrsAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(threeHrsAgo)).toBe("3h ago");
  });

  it("shows days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it("shows months ago", () => {
    const sixtyDaysAgo = new Date(
      Date.now() - 60 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(formatTimeAgo(sixtyDaysAgo)).toBe("2mo ago");
  });

  it("accepts Date object", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinAgo)).toBe("5m ago");
  });
});
