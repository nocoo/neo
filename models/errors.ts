/**
 * Typed error classes for the application.
 * Migrated from 2fa project with TypeScript.
 *
 * All errors extend AppError which provides:
 * - HTTP status code
 * - Structured details
 * - isOperational flag (operational vs programmer errors)
 * - JSON serialization
 */

// ── Base Error ──────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly statusCode: number;
  readonly details: Record<string, unknown>;
  readonly isOperational: boolean;
  readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = 500,
    details: Record<string, unknown> = {},
    isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

// ── Concrete Error Types ────────────────────────────────────────────────────

/** 401 — not authenticated */
export class AuthenticationError extends AppError {
  constructor(message = "Authentication required", details: Record<string, unknown> = {}) {
    super(message, 401, details);
  }
}

/** 403 — insufficient permissions */
export class AuthorizationError extends AppError {
  constructor(message = "Insufficient permissions", details: Record<string, unknown> = {}) {
    super(message, 403, details);
  }
}

/** 400 — invalid input */
export class ValidationError extends AppError {
  constructor(message = "Validation failed", details: Record<string, unknown> = {}) {
    super(message, 400, details);
  }
}

/** 404 — resource not found */
export class NotFoundError extends AppError {
  constructor(resource = "Resource", details: Record<string, unknown> = {}) {
    super(`${resource} not found`, 404, details);
  }
}

/** 409 — conflict */
export class ConflictError extends AppError {
  constructor(message = "Resource conflict", details: Record<string, unknown> = {}) {
    super(message, 409, details);
  }
}

/** 429 — rate limited */
export class RateLimitError extends AppError {
  constructor(message = "Too many requests", details: Record<string, unknown> = {}) {
    super(message, 429, details);
  }
}

/** 500 — configuration missing or invalid */
export class ConfigurationError extends AppError {
  constructor(message = "Configuration error", details: Record<string, unknown> = {}) {
    super(message, 500, details, false);
  }
}

/** 500 — encryption/decryption failure */
export class EncryptionError extends AppError {
  constructor(message = "Encryption error", details: Record<string, unknown> = {}) {
    super(message, 500, details);
  }
}

/** 500 — database operation failure */
export class DatabaseError extends AppError {
  constructor(message = "Database error", details: Record<string, unknown> = {}) {
    super(message, 500, details);
  }
}

// ── Error Factory ───────────────────────────────────────────────────────────

/**
 * Convenience factory for common error patterns.
 */
export const ErrorFactory = {
  missingConfig(key: string, details: Record<string, unknown> = {}) {
    return new ConfigurationError(`Missing configuration: ${key}`, details);
  },

  encryptionFailed(details: Record<string, unknown> = {}) {
    return new EncryptionError("Encryption failed", details);
  },

  decryptionFailed(details: Record<string, unknown> = {}) {
    return new EncryptionError("Decryption failed", details);
  },

  secretNotFound(id: string) {
    return new NotFoundError("Secret", { id });
  },

  backupNotFound(id: string) {
    return new NotFoundError("Backup", { id });
  },

  duplicateSecret(name: string, account: string) {
    return new ConflictError("Duplicate secret", { name, account });
  },

  unauthorized() {
    return new AuthenticationError();
  },

  forbidden(reason?: string) {
    return new AuthorizationError(reason || "Access denied");
  },

  rateLimited(retryAfterMs?: number) {
    return new RateLimitError("Too many requests", {
      ...(retryAfterMs ? { retryAfterMs } : {}),
    });
  },
};
