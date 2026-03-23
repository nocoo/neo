"use client";

/**
 * Developer Tools ViewModel — manages import/export and OTP testing.
 *
 * Provides import parsing, export formatting, and single-secret OTP verification.
 */

import { useState, useCallback } from "react";
import { useDashboardState } from "@/contexts/dashboard-context";
import {
  detectImportFormat,
  parseImport,
} from "@/models/import-parsers";
import { exportSecrets } from "@/models/export-formatters";
import { generateTOTP } from "@/models/otp";
import { validateBase32 } from "@/models/validation";
import type {
  ParsedSecret,
  ImportFormat,
  ExportFormat,
  Secret,
} from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface DevToolsViewModelState {
  /** Parsed secrets from import input. */
  parsedSecrets: ParsedSecret[];
  /** Detected import format. */
  detectedFormat: ImportFormat | null;
  /** Export output string. */
  exportOutput: string;
  /** OTP test result. */
  otpTestResult: string | null;
  /** Whether an operation is in progress. */
  busy: boolean;
  /** Error message from last operation. */
  error: string | null;
}

export interface DevToolsViewModelActions {
  /** Parse import content and detect format. */
  handleParseImport: (content: string, format?: ImportFormat) => void;
  /** Export current secrets in given format. */
  handleExport: (format: ExportFormat) => void;
  /** Generate a test OTP from a base32 secret. */
  handleTestOtp: (secret: string, options?: { digits?: number; period?: number; algorithm?: string }) => Promise<void>;
  /** Clear parsed secrets. */
  clearParsed: () => void;
  /** Clear export output. */
  clearExport: () => void;
  /** Clear error. */
  clearError: () => void;
}

export type DevToolsViewModel = DevToolsViewModelState & DevToolsViewModelActions;

// ── Helpers ──────────────────────────────────────────────────────────────

function secretToParsed(secret: Secret): ParsedSecret {
  return {
    name: secret.name,
    account: secret.account || "",
    secret: secret.secret,
    type: secret.type,
    digits: secret.digits,
    period: secret.period,
    algorithm: secret.algorithm,
    counter: secret.counter,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useDevToolsViewModel(): DevToolsViewModel {
  const { secrets } = useDashboardState();

  const [parsedSecrets, setParsedSecrets] = useState<ParsedSecret[]>([]);
  const [detectedFormat, setDetectedFormat] = useState<ImportFormat | null>(null);
  const [exportOutput, setExportOutput] = useState("");
  const [otpTestResult, setOtpTestResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Import parsing ────────────────────────────────────────────────────

  const handleParseImport = useCallback(
    (content: string, format?: ImportFormat) => {
      setError(null);
      try {
        const detected = format ?? detectImportFormat(content);
        setDetectedFormat(detected);

        if (!detected) {
          setError("Unable to detect import format");
          setParsedSecrets([]);
          return;
        }

        const parsed = parseImport(content, detected);
        setParsedSecrets(parsed);

        if (parsed.length === 0) {
          setError("No secrets found in imported data");
        }
      } catch {
        setError("Failed to parse import data");
        setParsedSecrets([]);
      }
    },
    []
  );

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = useCallback(
    (format: ExportFormat) => {
      setError(null);
      try {
        const parsedList = secrets.map(secretToParsed);
        const output = exportSecrets(parsedList, format);
        setExportOutput(output);
      } catch {
        setError("Failed to export secrets");
        setExportOutput("");
      }
    },
    [secrets]
  );

  // ── OTP testing ───────────────────────────────────────────────────────

  const handleTestOtp = useCallback(
    async (
      secret: string,
      options?: { digits?: number; period?: number; algorithm?: string }
    ) => {
      setError(null);
      setBusy(true);
      try {
        const validation = validateBase32(secret);
        if (!validation.valid) {
          setError("Invalid Base32 secret");
          setOtpTestResult(null);
          return;
        }

        const period = options?.period ?? 30;
        const counter = Math.floor(Date.now() / 1000 / period);
        const otp = await generateTOTP(secret, counter, {
          ...(options?.digits !== undefined ? { digits: options.digits } : {}),
          period,
          ...(options?.algorithm !== undefined ? { algorithm: options.algorithm } : {}),
        });
        setOtpTestResult(otp);
      } catch {
        setError("Failed to generate test OTP");
        setOtpTestResult(null);
      } finally {
        setBusy(false);
      }
    },
    []
  );

  // ── Clear helpers ─────────────────────────────────────────────────────

  const clearParsed = useCallback(() => {
    setParsedSecrets([]);
    setDetectedFormat(null);
  }, []);

  const clearExport = useCallback(() => {
    setExportOutput("");
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    parsedSecrets,
    detectedFormat,
    exportOutput,
    otpTestResult,
    busy,
    error,
    handleParseImport,
    handleExport,
    handleTestOtp,
    clearParsed,
    clearExport,
    clearError,
  };
}
