import { describe, it, expect } from "vitest";
import { rowToSecret, rowToUserSettings } from "@/lib/db/mappers";

describe("rowToSecret", () => {
  it("maps a D1 row to Secret type", () => {
    const row = {
      id: "sec-1",
      user_id: "user-1",
      name: "GitHub",
      account: "user@github.com",
      secret: "JBSWY3DPEHPK3PXP",
      type: "totp",
      digits: 6,
      period: 30,
      algorithm: "SHA-1",
      counter: 0,
      color: "blue",
      created_at: 1700000000,
      updated_at: 1700000000,
    };

    const secret = rowToSecret(row);
    expect(secret.id).toBe("sec-1");
    expect(secret.userId).toBe("user-1");
    expect(secret.name).toBe("GitHub");
    expect(secret.account).toBe("user@github.com");
    expect(secret.secret).toBe("JBSWY3DPEHPK3PXP");
    expect(secret.type).toBe("totp");
    expect(secret.digits).toBe(6);
    expect(secret.period).toBe(30);
    expect(secret.algorithm).toBe("SHA-1");
    expect(secret.counter).toBe(0);
    expect(secret.color).toBe("blue");
    expect(secret.createdAt).toBeInstanceOf(Date);
    expect(secret.updatedAt).toBeInstanceOf(Date);
  });

  it("handles null account", () => {
    const row = {
      id: "sec-2",
      user_id: "user-1",
      name: "Steam",
      account: null,
      secret: "AAAAAA",
      type: "totp",
      digits: 6,
      period: 30,
      algorithm: "SHA-1",
      counter: 0,
      created_at: 1700000000,
      updated_at: 1700000000,
    };

    const secret = rowToSecret(row);
    expect(secret.account).toBeNull();
    expect(secret.color).toBeNull();
  });

  it("applies defaults for missing OTP fields", () => {
    const row = {
      id: "sec-3",
      user_id: "user-1",
      name: "Test",
      account: null,
      secret: "BBB",
      type: null,
      digits: null,
      period: null,
      algorithm: null,
      counter: null,
      created_at: 1700000000,
      updated_at: 1700000000,
    };

    const secret = rowToSecret(row);
    expect(secret.type).toBe("totp");
    expect(secret.digits).toBe(6);
    expect(secret.period).toBe(30);
    expect(secret.algorithm).toBe("SHA-1");
    expect(secret.counter).toBe(0);
  });
});

describe("rowToUserSettings", () => {
  it("maps a D1 row to UserSettings type", () => {
    const row = {
      user_id: "user-1",
      encryption_key_hash: "hash123",
      theme: "dark",
      language: "zh",
    };

    const settings = rowToUserSettings(row);
    expect(settings.userId).toBe("user-1");
    expect(settings.encryptionKeyHash).toBe("hash123");
    expect(settings.theme).toBe("dark");
    expect(settings.language).toBe("zh");
  });

  it("handles null encryption key hash", () => {
    const row = {
      user_id: "user-1",
      encryption_key_hash: null,
      theme: "system",
      language: "en",
    };

    const settings = rowToUserSettings(row);
    expect(settings.encryptionKeyHash).toBeNull();
  });

  it("applies defaults for missing theme/language", () => {
    const row = {
      user_id: "user-1",
      encryption_key_hash: null,
      theme: null,
      language: null,
    };

    const settings = rowToUserSettings(row);
    expect(settings.theme).toBe("system");
    expect(settings.language).toBe("en");
  });
});
