"use client";

/**
 * Backup ViewModel — manages backup listing, creation, and cleanup.
 *
 * Connects to DashboardContext for summary stats and server actions for mutations.
 */

import { useState, useCallback } from "react";
import { useDashboardState, useDashboardActions } from "@/contexts/dashboard-context";
import {
  getBackups as getBackupsAction,
  createManualBackup as createManualBackupAction,
  cleanupBackups as cleanupBackupsAction,
} from "@/actions/backup";
import type { Backup } from "@/models/types";

// ── Types ────────────────────────────────────────────────────────────────

export interface BackupViewModelState {
  /** All backups (loaded on demand). */
  backups: Backup[];
  /** Total backup count from dashboard context. */
  backupCount: number;
  /** Last backup timestamp from dashboard context. */
  lastBackupAt: Date | null;
  /** Whether an operation is in progress. */
  busy: boolean;
  /** Error message from last operation. */
  error: string | null;
}

export interface BackupViewModelActions {
  /** Load all backups from server. */
  loadBackups: () => Promise<void>;
  /** Create a manual backup of the given secrets JSON. */
  handleCreateBackup: (secretsJson: string) => Promise<boolean>;
  /** Delete old backups beyond retention limit. */
  handleCleanup: () => Promise<{ deleted: number } | null>;
  /** Clear error state. */
  clearError: () => void;
}

export type BackupViewModel = BackupViewModelState & BackupViewModelActions;

// ── Hook ─────────────────────────────────────────────────────────────────

export function useBackupViewModel(): BackupViewModel {
  const { backupCount, lastBackupAt } = useDashboardState();
  const { handleBackupCreated } = useDashboardActions();

  const [backups, setBackups] = useState<Backup[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load backups ──────────────────────────────────────────────────────

  const loadBackups = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await getBackupsAction();
      if (result.success) {
        setBackups(result.data);
      } else {
        setError(result.error);
      }
    } catch {
      setError("Failed to load backups");
    } finally {
      setBusy(false);
    }
  }, []);

  // ── Create manual backup ──────────────────────────────────────────────

  const handleCreateBackup = useCallback(
    async (secretsJson: string): Promise<boolean> => {
      setBusy(true);
      setError(null);
      try {
        const result = await createManualBackupAction(secretsJson);
        if (result.success) {
          handleBackupCreated(result.data.createdAt);
          // Prepend to local list
          setBackups((prev) => [result.data, ...prev]);
          return true;
        }
        setError(result.error);
        return false;
      } catch {
        setError("Failed to create backup");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [handleBackupCreated]
  );

  // ── Cleanup old backups ───────────────────────────────────────────────

  const handleCleanup = useCallback(
    async (): Promise<{ deleted: number } | null> => {
      setBusy(true);
      setError(null);
      try {
        const result = await cleanupBackupsAction();
        if (result.success) {
          // Reload backups after cleanup
          const reloadResult = await getBackupsAction();
          if (reloadResult.success) {
            setBackups(reloadResult.data);
          }
          return result.data;
        }
        setError(result.error);
        return null;
      } catch {
        setError("Failed to cleanup backups");
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    backups,
    backupCount,
    lastBackupAt,
    busy,
    error,
    loadBackups,
    handleCreateBackup,
    handleCleanup,
    clearError,
  };
}
