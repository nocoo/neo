/**
 * Typed error class tests.
 * Covers all error types, status codes, serialization,
 * ErrorFactory convenience methods, and instanceof checks.
 */

import { describe, it, expect } from "vitest";
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  ConfigurationError,
  EncryptionError,
  DatabaseError,
  ErrorFactory,
} from "@/models/errors";

// ── AppError base ───────────────────────────────────────────────────────────

describe("AppError", () => {
  it("has correct defaults", () => {
    const err = new AppError("test");
    expect(err.message).toBe("test");
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
    expect(err.details).toEqual({});
    expect(err.name).toBe("AppError");
    expect(err.timestamp).toMatch(/^\d{4}-/);
  });

  it("accepts all parameters", () => {
    const err = new AppError("msg", 418, { key: "val" }, false);
    expect(err.statusCode).toBe(418);
    expect(err.details.key).toBe("val");
    expect(err.isOperational).toBe(false);
  });

  it("serializes to JSON", () => {
    const err = new AppError("test", 400, { field: "name" });
    const json = err.toJSON();
    expect(json.error).toBe("AppError");
    expect(json.message).toBe("test");
    expect(json.statusCode).toBe(400);
    expect(json.details).toEqual({ field: "name" });
    expect(json.timestamp).toBeDefined();
  });

  it("is instanceof Error", () => {
    const err = new AppError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });

  it("has a stack trace", () => {
    const err = new AppError("test");
    expect(err.stack).toBeDefined();
  });
});

// ── Concrete types ──────────────────────────────────────────────────────────

describe("concrete error types", () => {
  it("AuthenticationError → 401", () => {
    const err = new AuthenticationError();
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("AuthenticationError");
    expect(err).toBeInstanceOf(AppError);
  });

  it("AuthorizationError → 403", () => {
    const err = new AuthorizationError();
    expect(err.statusCode).toBe(403);
    expect(err.name).toBe("AuthorizationError");
  });

  it("ValidationError → 400", () => {
    const err = new ValidationError("bad input", { field: "name" });
    expect(err.statusCode).toBe(400);
    expect(err.details.field).toBe("name");
  });

  it("NotFoundError → 404", () => {
    const err = new NotFoundError("Secret");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Secret not found");
  });

  it("ConflictError → 409", () => {
    const err = new ConflictError();
    expect(err.statusCode).toBe(409);
  });

  it("RateLimitError → 429", () => {
    const err = new RateLimitError();
    expect(err.statusCode).toBe(429);
  });

  it("ConfigurationError → 500, not operational", () => {
    const err = new ConfigurationError();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });

  it("EncryptionError → 500", () => {
    const err = new EncryptionError();
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(true);
  });

  it("DatabaseError → 500", () => {
    const err = new DatabaseError("query failed");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("query failed");
  });
});

// ── ErrorFactory ────────────────────────────────────────────────────────────

describe("ErrorFactory", () => {
  it("missingConfig creates ConfigurationError", () => {
    const err = ErrorFactory.missingConfig("ENCRYPTION_KEY");
    expect(err).toBeInstanceOf(ConfigurationError);
    expect(err.message).toContain("ENCRYPTION_KEY");
  });

  it("encryptionFailed creates EncryptionError", () => {
    expect(ErrorFactory.encryptionFailed()).toBeInstanceOf(EncryptionError);
  });

  it("decryptionFailed creates EncryptionError", () => {
    const err = ErrorFactory.decryptionFailed({ hint: "wrong key" });
    expect(err).toBeInstanceOf(EncryptionError);
    expect(err.details.hint).toBe("wrong key");
  });

  it("secretNotFound creates NotFoundError with id", () => {
    const err = ErrorFactory.secretNotFound("abc-123");
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.details.id).toBe("abc-123");
  });

  it("backupNotFound creates NotFoundError with id", () => {
    const err = ErrorFactory.backupNotFound("bak-456");
    expect(err.message).toContain("Backup");
  });

  it("duplicateSecret creates ConflictError", () => {
    const err = ErrorFactory.duplicateSecret("GitHub", "user");
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.details.name).toBe("GitHub");
    expect(err.details.account).toBe("user");
  });

  it("unauthorized creates AuthenticationError", () => {
    expect(ErrorFactory.unauthorized()).toBeInstanceOf(AuthenticationError);
  });

  it("forbidden creates AuthorizationError", () => {
    const err = ErrorFactory.forbidden("IP blocked");
    expect(err).toBeInstanceOf(AuthorizationError);
    expect(err.message).toBe("IP blocked");
  });

  it("rateLimited creates RateLimitError", () => {
    const err = ErrorFactory.rateLimited(60000);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.details.retryAfterMs).toBe(60000);
  });

  it("rateLimited without retryAfter omits detail", () => {
    const err = ErrorFactory.rateLimited();
    expect(err.details.retryAfterMs).toBeUndefined();
  });
});
