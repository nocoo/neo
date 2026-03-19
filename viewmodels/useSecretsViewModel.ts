"use client";

/**
 * Secrets ViewModel — manages OTP generation, search, and CRUD operations.
 *
 * Connects to DashboardContext for state and server actions for mutations.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useDashboardState, useDashboardActions } from "@/contexts/dashboard-context";
import {
  createSecret as createSecretAction,
  updateSecret as updateSecretAction,
  deleteSecret as deleteSecretAction,
  batchImportSecrets as batchImportAction,
} from "@/actions/secrets";
import { generateTOTP } from "@/models/otp";
import type { Secret, CreateSecretInput, UpdateSecretInput, OtpResult } from "@/models/types";

// ── Helpers ──────────────────────────────────────────────────────────────

function computeRemaining(period: number): number {
  return period - (Math.floor(Date.now() / 1000) % period);
}

function computeCounter(period: number): number {
  return Math.floor(Date.now() / 1000 / period);
}

// ── Types ────────────────────────────────────────────────────────────────

export interface SecretsViewModelState {
  /** Filtered secrets based on search query. */
  filteredSecrets: Secret[];
  /** Search query string. */
  searchQuery: string;
  /** Map of secret ID → current OTP result. */
  otpMap: Map<string, OtpResult>;
  /** Whether an operation is in progress. */
  busy: boolean;
  /** Error message from last operation. */
  error: string | null;
}

export interface SecretsViewModelActions {
  setSearchQuery: (query: string) => void;
  handleCreate: (input: CreateSecretInput) => Promise<boolean>;
  handleUpdate: (input: UpdateSecretInput) => Promise<boolean>;
  handleDelete: (id: string) => Promise<boolean>;
  handleBatchImport: (secrets: CreateSecretInput[]) => Promise<{ imported: number; skipped: number } | null>;
  refreshOtp: (secretId: string) => Promise<void>;
  clearError: () => void;
}

export type SecretsViewModel = SecretsViewModelState & SecretsViewModelActions;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useSecretsViewModel(): SecretsViewModel {
  const { secrets } = useDashboardState();
  const {
    handleSecretCreated,
    handleSecretDeleted,
    handleSecretUpdated,
    handleSecretsReloaded,
  } = useDashboardActions();

  const [searchQuery, setSearchQuery] = useState("");
  const [otpMap, setOtpMap] = useState<Map<string, OtpResult>>(new Map());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Timer for OTP refresh
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Filtered secrets ──────────────────────────────────────────────────

  const filteredSecrets = useMemo(() => {
    if (!searchQuery.trim()) return secrets;
    const query = searchQuery.toLowerCase();
    return secrets.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        (s.account && s.account.toLowerCase().includes(query))
    );
  }, [secrets, searchQuery]);

  // ── OTP generation ────────────────────────────────────────────────────

  const generateOtpForSecret = useCallback(
    async (secret: Secret): Promise<OtpResult | null> => {
      if (secret.type !== "totp") return null;
      try {
        const period = secret.period || 30;
        const counter = computeCounter(period);
        const otp = await generateTOTP(secret.secret, counter, {
          digits: secret.digits,
          period,
          algorithm: secret.algorithm,
        });
        return {
          otp,
          remainingSeconds: computeRemaining(period),
          period,
        };
      } catch {
        return null;
      }
    },
    []
  );

  const generateAllOtps = useCallback(async () => {
    const newMap = new Map<string, OtpResult>();
    const entries = await Promise.all(
      secrets.map(async (secret) => {
        const result = await generateOtpForSecret(secret);
        return { id: secret.id, result };
      })
    );
    for (const { id, result } of entries) {
      if (result) {
        newMap.set(id, result);
      }
    }
    setOtpMap(newMap);
  }, [secrets, generateOtpForSecret]);

  // Auto-refresh OTPs every second
  useEffect(() => {
    generateAllOtps();

    intervalRef.current = setInterval(generateAllOtps, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [generateAllOtps]);

  const refreshOtp = useCallback(
    async (secretId: string) => {
      const secret = secrets.find((s) => s.id === secretId);
      if (!secret) return;
      const result = await generateOtpForSecret(secret);
      if (result) {
        setOtpMap((prev) => {
          const next = new Map(prev);
          next.set(secretId, result);
          return next;
        });
      }
    },
    [secrets, generateOtpForSecret]
  );

  // ── CRUD handlers ─────────────────────────────────────────────────────

  const handleCreate = useCallback(
    async (input: CreateSecretInput): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const result = await createSecretAction(input);
        if (result.success) {
          handleSecretCreated(result.data);
          return true;
        }
        setError(result.error);
        return false;
      } catch {
        setError("Failed to create secret");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [handleSecretCreated]
  );

  const handleUpdate = useCallback(
    async (input: UpdateSecretInput): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const result = await updateSecretAction(input);
        if (result.success) {
          handleSecretUpdated(result.data);
          return true;
        }
        setError(result.error);
        return false;
      } catch {
        setError("Failed to update secret");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [handleSecretUpdated]
  );

  const handleDelete = useCallback(
    async (id: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const result = await deleteSecretAction(id);
        if (result.success) {
          handleSecretDeleted(id);
          return true;
        }
        setError(result.error);
        return false;
      } catch {
        setError("Failed to delete secret");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [handleSecretDeleted]
  );

  const handleBatchImport = useCallback(
    async (
      importSecrets: CreateSecretInput[]
    ): Promise<{ imported: number; skipped: number } | null> => {
      setBusy(true);
      setError(null);
      try {
        const result = await batchImportAction(importSecrets);
        if (result.success) {
          // After batch import, we need to reload all secrets
          // since we don't get the created objects back individually
          const { getSecrets } = await import("@/actions/secrets");
          const secretsResult = await getSecrets();
          if (secretsResult.success) {
            handleSecretsReloaded(secretsResult.data);
          }
          return result.data;
        }
        setError(result.error);
        return null;
      } catch {
        setError("Failed to import secrets");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [handleSecretsReloaded]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    filteredSecrets,
    searchQuery,
    otpMap,
    busy,
    error,
    setSearchQuery,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleBatchImport,
    refreshOtp,
    clearError,
  };
}
