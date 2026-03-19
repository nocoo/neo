/**
 * Structured logger tests — migrated from 2fa project.
 * Covers 5 log levels, null guard (P5 fix), sanitization,
 * child loggers, performance timer, and log filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  Logger,
  LogLevel,
  PerformanceTimer,
  getLogger,
  resetLogger,
  sanitizeHeaders,
} from "@/lib/logger";

beforeEach(() => {
  resetLogger();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "debug").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Log Levels ──────────────────────────────────────────────────────────────

describe("Logger log levels", () => {
  it("logs at INFO level by default", () => {
    const logger = new Logger();
    const entry = logger.info("test");
    expect(entry).toBeDefined();
    expect(entry!.level).toBe("INFO");
  });

  it("filters messages below minLevel", () => {
    const logger = new Logger({ minLevel: LogLevel.WARN });
    expect(logger.debug("test")).toBeUndefined();
    expect(logger.info("test")).toBeUndefined();
    expect(logger.warn("test")).toBeDefined();
    expect(logger.error("test")).toBeDefined();
  });

  it("supports all 5 levels", () => {
    const logger = new Logger({ minLevel: LogLevel.DEBUG });
    expect(logger.debug("d")!.level).toBe("DEBUG");
    expect(logger.info("i")!.level).toBe("INFO");
    expect(logger.warn("w")!.level).toBe("WARN");
    expect(logger.error("e")!.level).toBe("ERROR");
    expect(logger.fatal("f")!.level).toBe("FATAL");
  });

  it("can change minLevel at runtime", () => {
    const logger = new Logger({ minLevel: LogLevel.ERROR });
    expect(logger.info("test")).toBeUndefined();
    logger.setMinLevel(LogLevel.DEBUG);
    expect(logger.info("test")).toBeDefined();
  });
});

// ── Null Guard (P5 Fix) ────────────────────────────────────────────────────

describe("P5 fix: null data parameter", () => {
  it("handles null data without throwing", () => {
    const logger = new Logger();
    expect(() => logger.info("test", null)).not.toThrow();
    const entry = logger.info("test", null);
    expect(entry).toBeDefined();
    expect(entry!.message).toBe("test");
  });

  it("handles undefined data without throwing", () => {
    const logger = new Logger();
    expect(() => logger.info("test", undefined)).not.toThrow();
  });

  it("handles null error without throwing", () => {
    const logger = new Logger();
    expect(() => logger.error("test", null, null)).not.toThrow();
  });

  it("handles null data in warn/error/fatal", () => {
    const logger = new Logger();
    expect(() => logger.warn("w", null)).not.toThrow();
    expect(() => logger.error("e", null)).not.toThrow();
    expect(() => logger.fatal("f", null)).not.toThrow();
  });
});

// ── Data and Error Logging ──────────────────────────────────────────────────

describe("Logger data and errors", () => {
  it("includes data in log entry", () => {
    const logger = new Logger();
    const entry = logger.info("test", { userId: "123", action: "login" });
    expect(entry!.userId).toBe("123");
    expect(entry!.action).toBe("login");
  });

  it("includes error details when provided", () => {
    const logger = new Logger();
    const err = new Error("test error");
    const entry = logger.error("failed", {}, err);
    expect(entry!.error).toBeDefined();
    const errorInfo = entry!.error as { name: string; message: string };
    expect(errorInfo.name).toBe("Error");
    expect(errorInfo.message).toBe("test error");
  });

  it("includes timestamp in ISO format", () => {
    const logger = new Logger();
    const entry = logger.info("test");
    expect(entry!.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── Child Logger ────────────────────────────────────────────────────────────

describe("child logger", () => {
  it("inherits parent context", () => {
    const parent = new Logger({ minLevel: LogLevel.DEBUG, context: { service: "neo" } });
    const child = parent.child({ module: "api" });
    const entry = child.info("test");
    expect(entry!.service).toBe("neo");
    expect(entry!.module).toBe("api");
  });

  it("child context overrides parent context", () => {
    const parent = new Logger({ context: { env: "dev" } });
    const child = parent.child({ env: "prod" });
    const entry = child.info("test");
    expect(entry!.env).toBe("prod");
  });
});

// ── sanitizeHeaders ─────────────────────────────────────────────────────────

describe("sanitizeHeaders", () => {
  it("redacts sensitive headers", () => {
    const headers = new Headers({
      authorization: "Bearer token",
      cookie: "session=abc",
      "x-api-key": "secret",
      "content-type": "application/json",
    });

    const sanitized = sanitizeHeaders(headers);
    expect(sanitized["authorization"]).toBe("***REDACTED***");
    expect(sanitized["cookie"]).toBe("***REDACTED***");
    expect(sanitized["x-api-key"]).toBe("***REDACTED***");
    expect(sanitized["content-type"]).toBe("application/json");
  });

  it("handles plain object headers", () => {
    const headers = {
      Authorization: "Bearer token",
      "Content-Type": "text/html",
    };

    const sanitized = sanitizeHeaders(headers);
    expect(sanitized["Authorization"]).toBe("***REDACTED***");
    expect(sanitized["Content-Type"]).toBe("text/html");
  });

  it("handles null/undefined", () => {
    expect(sanitizeHeaders(null)).toEqual({});
    expect(sanitizeHeaders(undefined)).toEqual({});
  });
});

// ── PerformanceTimer ────────────────────────────────────────────────────────

describe("PerformanceTimer", () => {
  it("measures elapsed time", () => {
    const logger = new Logger({ minLevel: LogLevel.DEBUG });
    const timer = new PerformanceTimer("test-op", logger);
    const result = timer.end();
    expect(result.name).toBe("test-op");
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.checkpoints).toEqual([]);
  });

  it("records checkpoints", () => {
    const logger = new Logger({ minLevel: LogLevel.DEBUG });
    const timer = new PerformanceTimer("test-op", logger);
    timer.checkpoint("step1");
    timer.checkpoint("step2");
    const result = timer.end();
    expect(result.checkpoints).toHaveLength(2);
    expect(result.checkpoints[0].label).toBe("step1");
    expect(result.checkpoints[1].label).toBe("step2");
  });

  it("can be cancelled", () => {
    const logger = new Logger({ minLevel: LogLevel.DEBUG });
    const timer = new PerformanceTimer("test-op", logger);
    expect(() => timer.cancel()).not.toThrow();
  });

  it("end accepts null data (P5 fix)", () => {
    const logger = new Logger({ minLevel: LogLevel.DEBUG });
    const timer = new PerformanceTimer("test-op", logger);
    expect(() => timer.end(null)).not.toThrow();
  });
});

// ── Singleton ───────────────────────────────────────────────────────────────

describe("getLogger / resetLogger", () => {
  it("returns the same instance", () => {
    const a = getLogger();
    const b = getLogger();
    expect(a).toBe(b);
  });

  it("reset creates a new instance", () => {
    const a = getLogger();
    resetLogger();
    const b = getLogger();
    expect(a).not.toBe(b);
  });
});

// ── Console Output ──────────────────────────────────────────────────────────

describe("console output", () => {
  it("disables console when configured", () => {
    const logger = new Logger({ enableConsole: false });
    logger.info("silent");
    expect(console.log).not.toHaveBeenCalled();
  });

  it("routes to correct console method", () => {
    const logger = new Logger({ minLevel: LogLevel.DEBUG });
    logger.debug("d");
    expect(console.debug).toHaveBeenCalled();
    logger.warn("w");
    expect(console.warn).toHaveBeenCalled();
    logger.error("e");
    expect(console.error).toHaveBeenCalled();
  });
});
