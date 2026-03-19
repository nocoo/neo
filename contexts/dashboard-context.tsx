"use client";

/**
 * Dashboard Context — split state/actions to prevent unnecessary re-renders.
 *
 * DashboardStateContext: data that changes (secrets, loading, etc.)
 * DashboardActionsContext: callbacks that are stable (never cause re-render)
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { getDashboardData } from "@/actions/dashboard";
import type { Secret } from "@/models/types";

// ── State Context ────────────────────────────────────────────────────────

export interface DashboardState {
  secrets: Secret[];
  backupCount: number;
  lastBackupAt: Date | null;
  encryptionEnabled: boolean;
  loading: boolean;
  error: string | null;
}

const DashboardStateContext = createContext<DashboardState | null>(null);

// ── Actions Context ─────────────────────────────────────────────────────

export interface DashboardActions {
  /** Add a newly created secret to the in-memory list. */
  handleSecretCreated: (secret: Secret) => void;
  /** Remove a deleted secret from the in-memory list. */
  handleSecretDeleted: (id: string) => void;
  /** Update a secret in the in-memory list. */
  handleSecretUpdated: (secret: Secret) => void;
  /** Replace all secrets (e.g., after batch import). */
  handleSecretsReloaded: (secrets: Secret[]) => void;
  /** Increment backup count. */
  handleBackupCreated: (createdAt: Date) => void;
  /** Re-fetch all dashboard data from the server. */
  refresh: () => Promise<void>;
}

const DashboardActionsContext = createContext<DashboardActions | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────

interface DashboardProviderProps {
  children: ReactNode;
  initialData?: {
    secrets: Secret[];
    backupCount: number;
    lastBackupAt: Date | null;
    encryptionEnabled: boolean;
  };
}

export function DashboardProvider({ children, initialData }: DashboardProviderProps) {
  const [secrets, setSecrets] = useState<Secret[]>(initialData?.secrets ?? []);
  const [backupCount, setBackupCount] = useState(initialData?.backupCount ?? 0);
  const [lastBackupAt, setLastBackupAt] = useState<Date | null>(initialData?.lastBackupAt ?? null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(initialData?.encryptionEnabled ?? false);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  // Fetch data on mount if no initial data was provided
  useEffect(() => {
    if (initialData) return;

    let cancelled = false;

    (async () => {
      const result = await getDashboardData();
      if (cancelled) return;

      if (result.success) {
        setSecrets(result.data.secrets);
        setBackupCount(result.data.backupCount);
        setLastBackupAt(result.data.lastBackupAt);
        setEncryptionEnabled(result.data.encryptionEnabled);
        setError(null);
      } else {
        setError(result.error);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  // ── Actions (stable callbacks) ──────────────────────────────────────

  const handleSecretCreated = useCallback((secret: Secret) => {
    setSecrets((prev) => [secret, ...prev]);
  }, []);

  const handleSecretDeleted = useCallback((id: string) => {
    setSecrets((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const handleSecretUpdated = useCallback((secret: Secret) => {
    setSecrets((prev) =>
      prev.map((s) => (s.id === secret.id ? secret : s))
    );
  }, []);

  const handleSecretsReloaded = useCallback((newSecrets: Secret[]) => {
    setSecrets(newSecrets);
  }, []);

  const handleBackupCreated = useCallback((createdAt: Date) => {
    setBackupCount((prev) => prev + 1);
    setLastBackupAt(createdAt);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getDashboardData();
    if (result.success) {
      setSecrets(result.data.secrets);
      setBackupCount(result.data.backupCount);
      setLastBackupAt(result.data.lastBackupAt);
      setEncryptionEnabled(result.data.encryptionEnabled);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  // ── Memoized values ─────────────────────────────────────────────────

  const stateValue = useMemo<DashboardState>(
    () => ({ secrets, backupCount, lastBackupAt, encryptionEnabled, loading, error }),
    [secrets, backupCount, lastBackupAt, encryptionEnabled, loading, error]
  );

  const actionsValue = useMemo<DashboardActions>(
    () => ({
      handleSecretCreated,
      handleSecretDeleted,
      handleSecretUpdated,
      handleSecretsReloaded,
      handleBackupCreated,
      refresh,
    }),
    [handleSecretCreated, handleSecretDeleted, handleSecretUpdated, handleSecretsReloaded, handleBackupCreated, refresh]
  );

  return (
    <DashboardActionsContext.Provider value={actionsValue}>
      <DashboardStateContext.Provider value={stateValue}>
        {children}
      </DashboardStateContext.Provider>
    </DashboardActionsContext.Provider>
  );
}

// ── Consumer hooks ────────────────────────────────────────────────────────

/** Subscribe to dashboard state only. */
export function useDashboardState(): DashboardState {
  const ctx = useContext(DashboardStateContext);
  if (!ctx) throw new Error("useDashboardState must be used within DashboardProvider");
  return ctx;
}

/** Subscribe to dashboard actions only (stable — no re-renders). */
export function useDashboardActions(): DashboardActions {
  const ctx = useContext(DashboardActionsContext);
  if (!ctx) throw new Error("useDashboardActions must be used within DashboardProvider");
  return ctx;
}

/** Subscribe to both state and actions (convenience). */
export function useDashboardService(): DashboardState & DashboardActions {
  return { ...useDashboardState(), ...useDashboardActions() };
}
