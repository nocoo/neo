/**
 * Structured logger — 5 levels, sensitive data redaction, null guard (fix P5).
 * Migrated from 2fa project with TypeScript types.
 *
 * P5 fix: all data parameters accept null/undefined without throwing.
 */

// ── Log Levels ──────────────────────────────────────────────────────────────

export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4,
} as const;

export type LogLevelName = keyof typeof LogLevel;
export type LogLevelValue = (typeof LogLevel)[LogLevelName];

const LEVEL_NAMES: Record<number, string> = {
  0: "DEBUG",
  1: "INFO",
  2: "WARN",
  3: "ERROR",
  4: "FATAL",
};

// ── Sensitive Header Redaction ──────────────────────────────────────────────

const SENSITIVE_HEADERS = new Set(["authorization", "cookie", "x-api-key"]);
const REDACTED = "***REDACTED***";

/**
 * Redact sensitive values from a Headers-like object.
 */
export function sanitizeHeaders(
  headers: Headers | Record<string, string> | null | undefined
): Record<string, string> {
  const result: Record<string, string> = {};

  if (!headers) return result;

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
    });
  } else {
    for (const [key, value] of Object.entries(headers)) {
      result[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? REDACTED : value;
    }
  }

  return result;
}

// ── Log Entry ───────────────────────────────────────────────────────────────

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  [key: string]: unknown;
}

// ── Logger ──────────────────────────────────────────────────────────────────

export interface LoggerOptions {
  minLevel?: LogLevelValue;
  enableConsole?: boolean;
  context?: Record<string, unknown>;
}

export class Logger {
  private minLevel: LogLevelValue;
  private enableConsole: boolean;
  private context: Record<string, unknown>;

  constructor(options: LoggerOptions = {}) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.enableConsole = options.enableConsole !== false;
    this.context = options.context || {};
  }

  /**
   * Core log method.
   * P5 fix: data can be null/undefined — safely spread as empty object.
   */
  private log(
    level: LogLevelValue,
    message: string,
    data?: Record<string, unknown> | null,
    error?: Error | null
  ): LogEntry | undefined {
    if (level < this.minLevel) return undefined;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level] || "UNKNOWN",
      message,
      ...this.context,
      ...(data || {}), // P5 fix: null guard
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    if (this.enableConsole) {
      this.writeToConsole(level, message, entry);
    }

    return entry;
  }

  private writeToConsole(
    level: LogLevelValue,
    message: string,
    entry: LogEntry
  ): void {
    const prefix = `[${LEVEL_NAMES[level]}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(prefix, entry);
        break;
      case LogLevel.WARN:
        console.warn(prefix, entry);
        break;
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(prefix, entry);
        break;
      default:
        console.log(prefix, entry);
    }
  }

  debug(message: string, data?: Record<string, unknown> | null): LogEntry | undefined {
    return this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: Record<string, unknown> | null): LogEntry | undefined {
    return this.log(LogLevel.INFO, message, data);
  }

  warn(
    message: string,
    data?: Record<string, unknown> | null,
    error?: Error | null
  ): LogEntry | undefined {
    return this.log(LogLevel.WARN, message, data, error);
  }

  error(
    message: string,
    data?: Record<string, unknown> | null,
    error?: Error | null
  ): LogEntry | undefined {
    return this.log(LogLevel.ERROR, message, data, error);
  }

  fatal(
    message: string,
    data?: Record<string, unknown> | null,
    error?: Error | null
  ): LogEntry | undefined {
    return this.log(LogLevel.FATAL, message, data, error);
  }

  /**
   * Create a child logger with additional context.
   */
  child(context: Record<string, unknown>): Logger {
    return new Logger({
      minLevel: this.minLevel,
      enableConsole: this.enableConsole,
      context: { ...this.context, ...context },
    });
  }

  /**
   * Update the minimum log level at runtime.
   */
  setMinLevel(level: LogLevelValue): void {
    this.minLevel = level;
  }
}

// ── Performance Timer ───────────────────────────────────────────────────────

export interface TimerCheckpoint {
  label: string;
  elapsed: number;
}

export class PerformanceTimer {
  private name: string;
  private logger: Logger;
  private startTime: number;
  private checkpoints: TimerCheckpoint[];

  constructor(name: string, logger?: Logger) {
    this.name = name;
    this.logger = logger || getLogger();
    this.startTime = Date.now();
    this.checkpoints = [];
  }

  checkpoint(label: string): number {
    const elapsed = Date.now() - this.startTime;
    this.checkpoints.push({ label, elapsed });
    this.logger.debug(`[${this.name}] Checkpoint: ${label}`, { elapsed });
    return elapsed;
  }

  end(data?: Record<string, unknown> | null): {
    name: string;
    duration: number;
    checkpoints: TimerCheckpoint[];
  } {
    const duration = Date.now() - this.startTime;
    this.logger.info(`[${this.name}] Completed`, {
      duration,
      checkpoints: this.checkpoints,
      ...(data || {}),
    });
    return { name: this.name, duration, checkpoints: this.checkpoints };
  }

  cancel(): void {
    this.logger.debug(`[${this.name}] Cancelled`);
  }
}

// ── Singleton ───────────────────────────────────────────────────────────────

let defaultLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = new Logger();
  }
  return defaultLogger;
}

export function resetLogger(): void {
  defaultLogger = null;
}
